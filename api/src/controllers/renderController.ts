import { Request, Response } from 'express';
import { renderDocx, extractPlaceholders } from '../services/docxService';
import { convertDocxToPdf, convertHtmlToPdf, convertUrlToPdf } from '../services/gotenbergService';
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

export async function renderPdf(req: MulterRequest, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: MulterFile[] };
    
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

    // Collect images
    const images: Record<string, Buffer> = {};
    const imageFields = ['signature', 'logo'];
    for (const field of imageFields) {
      const imageFiles = files?.[field];
      if (imageFiles && imageFiles.length > 0) {
        images[field] = imageFiles[0].buffer;
        logger.info(`Received image: ${field}`);
      }
    }

    // Also collect any other image uploads
    if (files) {
      for (const [key, fileArray] of Object.entries(files)) {
        if (!['template'].includes(key) && fileArray.length > 0) {
          images[key] = fileArray[0].buffer;
        }
      }
    }

    const docxBuffer = renderDocx({ templateBuffer, data, images });
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`PDF rendered successfully, size: ${pdfBuffer.length} bytes`);
  } catch (error) {
    const err = error as Error;
    logger.error('Render failed', err);
    res.status(500).json({ error: err.message || 'Render failed' });
  }
}

export async function previewPdf(req: MulterRequest, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: MulterFile[] };
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

    const docxBuffer = renderDocx({ templateBuffer, data });
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    res.json({
      success: true,
      pdf: pdfBuffer.toString('base64'),
      size: pdfBuffer.length,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Preview failed', err);
    res.status(500).json({ error: err.message || 'Preview failed' });
  }
}

export async function analyzePlaceholders(req: MulterRequest, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: MulterFile[] };
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
