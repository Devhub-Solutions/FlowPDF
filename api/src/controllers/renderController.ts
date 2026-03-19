import { Request, Response } from 'express';
import sharp from 'sharp';
import { renderDocx, extractPlaceholders, TemplateRenderError } from '../services/docxService';
import { convertDocxToPdf, convertHtmlToPdf, convertUrlToPdf } from '../services/gotenbergService';
import { sanitizeDocxXml } from '../services/docxSanitize';
import { logger } from '../utils/logger';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

type MulterRequest = Request & {
  files?: {
    [fieldname: string]: MulterFile[];
  } | MulterFile[];
};

interface ImageSizeOption {
  width: number;
  height: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function extractImageSizeOptions(data: Record<string, unknown>): {
  renderData: Record<string, unknown>;
  imageSizes: Record<string, ImageSizeOption>;
} {
  const renderData = { ...data };
  const imageSizes: Record<string, ImageSizeOption> = {};
  const imageOptionSources = ['imageOptions', '_imageOptions'];

  for (const sourceKey of imageOptionSources) {
    const sourceValue = renderData[sourceKey];
    if (!isRecord(sourceValue)) {
      delete renderData[sourceKey];
      continue;
    }

    for (const [imageName, rawConfig] of Object.entries(sourceValue)) {
      if (!isRecord(rawConfig)) {
        throw new Error(
          `Invalid image size config for "${imageName}". Use an object like {"width":180,"height":60}.`
        );
      }

      const width =
        parsePositiveNumber(rawConfig.width) ??
        parsePositiveNumber(rawConfig.widthPx) ??
        parsePositiveNumber(rawConfig.w);
      const height =
        parsePositiveNumber(rawConfig.height) ??
        parsePositiveNumber(rawConfig.heightPx) ??
        parsePositiveNumber(rawConfig.h);

      if (!width && !height) {
        throw new Error(
          `Invalid image size config for "${imageName}". Provide width and/or height as positive numbers.`
        );
      }

      imageSizes[imageName] = {
        width: width ?? height ?? 150,
        height: height ?? width ?? 100,
      };
    }

    delete renderData[sourceKey];
  }

  return { renderData, imageSizes };
}

function groupFilesByField(files: MulterRequest['files']): Record<string, MulterFile[]> {
  if (!files) return {};
  if (Array.isArray(files)) {
    const grouped: Record<string, MulterFile[]> = {};
    for (const file of files) {
      if (!grouped[file.fieldname]) grouped[file.fieldname] = [];
      grouped[file.fieldname].push(file);
    }
    return grouped;
  }
  return files;
}

async function normalizeTemplateImage(file: MulterFile): Promise<Buffer> {
  return sharp(file.buffer)
    .png()
    .toBuffer();
}

export async function renderPdf(req: MulterRequest, res: Response): Promise<void> {
  try {
    const files = groupFilesByField(req.files);
    
    // Handle HTML render
    if (req.body.html) {
      const pdf = await convertHtmlToPdf(req.body.html as string);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
      res.send(pdf);
      return;
    }

    // Handle URL render
    if (req.body.url) {
      const pdf = await convertUrlToPdf(req.body.url as string);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
      res.send(pdf);
      return;
    }

    // Handle DOCX template render
    const templateFiles = files?.['template'];
    if (!templateFiles || templateFiles.length === 0) {
      res.status(400).json({ error: 'No template file provided' });
      return;
    }

    const templateBuffer = templateFiles[0].buffer;

    let data: Record<string, unknown> = {};
    if (req.body.data) {
      try {
        data = JSON.parse(req.body.data as string);
      } catch {
        res.status(400).json({ error: 'Invalid JSON in data field' });
        return;
      }
    }

    const placeholders = new Set(extractPlaceholders(templateBuffer));
    const { renderData, imageSizes } = extractImageSizeOptions(data);

    // Collect images
    const images: Record<string, Buffer> = {};
    if (files) {
      for (const [key, fileArray] of Object.entries(files)) {
        if (key !== 'template' && fileArray.length > 0) {
          const file = fileArray[0];

          if (!placeholders.has(`%${key}`)) {
            res.status(400).json({
              error: `Image field "${key}" was uploaded but template is missing image placeholder {%${key}}.`,
            });
            return;
          }

          try {
            images[key] = await normalizeTemplateImage(file);
          } catch (error) {
            logger.warn(`Failed to normalize image ${key}: ${(error as Error).message}`);
            res.status(400).json({
              error: `Invalid or unsupported image data for field "${key}". Upload any image format supported by Sharp.`,
            });
            return;
          }
          renderData[key] = data[key] ?? file.originalname ?? key;
          logger.info(`Received image: ${key} (${file.mimetype})`);
        }
      }
    }

    const docxBuffer = renderDocx({ templateBuffer, data: renderData, images, imageSizes });
    const pdfBuffer = await convertDocxToPdf(sanitizeDocxXml(docxBuffer));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`PDF rendered successfully, size: ${pdfBuffer.length} bytes`);
  } catch (error) {
    const err = error as Error;
    logger.error('Render failed', err);
    if (error instanceof TemplateRenderError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message || 'Render failed' });
  }
}

export async function previewPdf(req: MulterRequest, res: Response): Promise<void> {
  try {
    const files = groupFilesByField(req.files);

    // Handle HTML preview
    if (req.body.html) {
      const pdfBuffer = await convertHtmlToPdf(req.body.html as string);
      res.json({
        success: true,
        pdf: pdfBuffer.toString('base64'),
        size: pdfBuffer.length,
      });
      return;
    }

    // Handle URL preview
    if (req.body.url) {
      const pdfBuffer = await convertUrlToPdf(req.body.url as string);
      res.json({
        success: true,
        pdf: pdfBuffer.toString('base64'),
        size: pdfBuffer.length,
      });
      return;
    }

    // Handle DOCX template preview
    const templateFiles = files?.['template'];

    if (!templateFiles || templateFiles.length === 0) {
      res.status(400).json({ error: 'No template file provided' });
      return;
    }

    const templateBuffer = templateFiles[0].buffer;
    let data: Record<string, unknown> = {};

    if (req.body.data) {
      try {
        data = JSON.parse(req.body.data as string);
      } catch {
        res.status(400).json({ error: 'Invalid JSON in data field' });
        return;
      }
    }

    const placeholders = new Set(extractPlaceholders(templateBuffer));
    const { renderData, imageSizes } = extractImageSizeOptions(data);

    // Collect images
    const images: Record<string, Buffer> = {};
    if (files) {
      for (const [key, fileArray] of Object.entries(files)) {
        if (key !== 'template' && fileArray.length > 0) {
          const file = fileArray[0];
          if (!placeholders.has(`%${key}`)) {
            res.status(400).json({
              error: `Image field "${key}" was uploaded but template is missing image placeholder {%${key}}.`,
            });
            return;
          }

          try {
            images[key] = await normalizeTemplateImage(file);
          } catch (error) {
            res.status(400).json({
              error: `Invalid or unsupported image data for field "${key}". Upload any image format supported by Sharp.`,
            });
            return;
          }
          renderData[key] = data[key] ?? file.originalname ?? key;
          logger.info(`Preview received image: ${key} (${file.mimetype})`);
        }
      }
    }

    const docxBuffer = renderDocx({ templateBuffer, data: renderData, images, imageSizes });
    const pdfBuffer = await convertDocxToPdf(sanitizeDocxXml(docxBuffer));

    res.json({
      success: true,
      pdf: pdfBuffer.toString('base64'),
      size: pdfBuffer.length,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Preview failed', err);
    if (error instanceof TemplateRenderError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message || 'Preview failed' });
  }
}

export async function analyzePlaceholders(req: MulterRequest, res: Response): Promise<void> {
  try {
    const files = groupFilesByField(req.files);
    const templateFiles = files?.['template'];

    if (!templateFiles || templateFiles.length === 0) {
      res.status(400).json({ error: 'No template file provided' });
      return;
    }

    const placeholders = extractPlaceholders(templateFiles[0].buffer);
    res.json({ placeholders });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
}
