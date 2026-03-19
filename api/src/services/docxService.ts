import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { logger } from '../utils/logger';

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateRenderError';
  }
}

interface DocxtemplaterError {
  name?: string;
  message?: string;
  properties?: {
    errors?: Array<{ properties?: { explanation?: string } }>;
    explanation?: string;
  };
}

export interface RenderOptions {
  templateBuffer: Buffer;
  data: Record<string, unknown>;
  images?: Record<string, Buffer>;
  imageSizes?: Record<string, { width: number; height: number }>;
}

export function extractPlaceholders(templateBuffer: Buffer): string[] {
  try {
    const zip = new PizZip(templateBuffer);
    const normalRegex = /\{([^{}%#/^@*]+)\}/g;
    const imageRegex = /\{%([^{}]+)\}/g;
    const placeholders = new Set<string>();

    for (const [fileName, file] of Object.entries(zip.files)) {
      if (!fileName.startsWith('word/') || !fileName.endsWith('.xml')) {
        continue;
      }

      const content = file.asText();
      let match: RegExpExecArray | null;

      normalRegex.lastIndex = 0;
      imageRegex.lastIndex = 0;

      while ((match = normalRegex.exec(content)) !== null) {
        placeholders.add(match[1].trim());
      }
      while ((match = imageRegex.exec(content)) !== null) {
        placeholders.add('%' + match[1].trim());
      }
    }

    logger.info(`Extracted ${placeholders.size} placeholders`);
    return Array.from(placeholders);
  } catch (error) {
    logger.error('Failed to extract placeholders', error);
    return [];
  }
}

/**
 * Scans DOCX XML for paragraphs whose visible text contains a {%tagName} image
 * placeholder and replaces the entire paragraph with a simple text-marker paragraph
 * that docxtemplater will pass through unchanged.
 */
function preprocessImageTags(zip: PizZip, imageTags: string[]): Record<string, boolean> {
  const found: Record<string, boolean> = Object.fromEntries(imageTags.map((t) => [t, false]));

  for (const [fileName, file] of Object.entries(zip.files)) {
    if (
      !fileName.startsWith('word/') ||
      !fileName.endsWith('.xml') ||
      fileName.includes('_rels') ||
      fileName.includes('media')
    ) {
      continue;
    }

    let xml = file.asText();
    let modified = false;

    for (const tagName of imageTags) {
      const marker = `__DOCX_IMG_${tagName}__`;
      let searchPos = 0;

      while (true) {
        const pStart = xml.indexOf('<w:p', searchPos);
        if (pStart === -1) break;

        // Paragraphs do not nest in DOCX — safe to find the next </w:p>
        const pEnd = xml.indexOf('</w:p>', pStart);
        if (pEnd === -1) break;

        const paraBlock = xml.substring(pStart, pEnd + 6);

        // Concatenate visible text from all <w:t> elements to detect the placeholder
        const textContent = Array.from(
          paraBlock.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g),
          (m) => m[1]
        ).join('');

        if (textContent.includes(`{%${tagName}}`)) {
          const replacement = `<w:p><w:r><w:t>${marker}</w:t></w:r></w:p>`;
          xml = xml.substring(0, pStart) + replacement + xml.substring(pEnd + 6);
          found[tagName] = true;
          modified = true;
          searchPos = pStart + replacement.length;
        } else {
          searchPos = pEnd + 6;
        }
      }
    }

    if (modified) {
      zip.file(fileName, xml);
    }
  }

  return found;
}

/**
 * Builds a self-contained DOCX inline-image XML fragment with all required
 * namespace declarations declared inline (LibreOffice-compatible).
 */
function buildInlineImageXml(
  relId: string,
  widthEMU: number,
  heightEMU: number,
  name: string,
  docPrId: number
): string {
  return (
    `<w:p>` +
    `<w:r>` +
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"` +
    ` xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<wp:extent cx="${widthEMU}" cy="${heightEMU}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="Image_${name}"/>` +
    `<wp:cNvGraphicFramePr>` +
    `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
    `</wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="${docPrId}" name="Image_${name}"/>` +
    `<pic:cNvPicPr/>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="${relId}"` +
    ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr>` +
    `<a:xfrm>` +
    `<a:off x="0" y="0"/>` +
    `<a:ext cx="${widthEMU}" cy="${heightEMU}"/>` +
    `</a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData>` +
    `</a:graphic>` +
    `</wp:inline>` +
    `</w:drawing>` +
    `</w:r>` +
    `</w:p>`
  );
}

const DEFAULT_IMAGE_SIZES: Record<string, [number, number]> = {
  signature: [150, 50],
  logo: [120, 60],
};

/**
 * After docxtemplater renders text fields, inject each image buffer into the ZIP
 * by replacing its marker paragraph and registering the media file + relationship.
 */
function postprocessInjectImages(
  zip: PizZip,
  images: Record<string, Buffer>,
  imageSizes: Record<string, { width: number; height: number }>
): void {
  const ctPath = '[Content_Types].xml';
  let ctXml = zip.files[ctPath]?.asText() ?? '';

  const relsPath = 'word/_rels/document.xml.rels';
  let relsXml =
    zip.files[relsPath]?.asText() ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '</Relationships>';

  // Ensure PNG content type is registered once
  if (!ctXml.includes('Extension="png"')) {
    ctXml = ctXml.replace(
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/></Types>'
    );
    zip.file(ctPath, ctXml);
  }

  // Use IDs starting high to avoid collisions with existing embedded objects
  let docPrCounter = 200;

  for (const [imageName, imageBuffer] of Object.entries(images)) {
    const marker = `__DOCX_IMG_${imageName}__`;
    const mediaFileName = `word/media/img_${imageName}.png`;
    const relId = `rIdImg${docPrCounter}`;
    const configuredSize = imageSizes[imageName];
    const [defaultWidthPx, defaultHeightPx] = DEFAULT_IMAGE_SIZES[imageName] ?? [150, 100];
    const widthPx = configuredSize?.width ?? defaultWidthPx;
    const heightPx = configuredSize?.height ?? defaultHeightPx;
    const widthEMU = widthPx * 9525;
    const heightEMU = heightPx * 9525;

    // Add image file to ZIP
    zip.file(mediaFileName, imageBuffer);
    logger.info(`Added image media: ${mediaFileName} (${imageBuffer.length} bytes)`);
    logger.info(`Using image size for ${imageName}: ${widthPx}x${heightPx}px`);

    // Register relationship
    const newRel =
      `<Relationship Id="${relId}"` +
      ` Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"` +
      ` Target="media/img_${imageName}.png"/>`;
    relsXml = relsXml.replace('</Relationships>', `${newRel}</Relationships>`);

    // Build the drawing XML fragment
    const drawingXml = buildInlineImageXml(relId, widthEMU, heightEMU, imageName, docPrCounter);

    // Replace the marker paragraph in every word XML file
    for (const [fileName, file] of Object.entries(zip.files)) {
      if (
        !fileName.startsWith('word/') ||
        !fileName.endsWith('.xml') ||
        fileName.includes('_rels') ||
        fileName.includes('media')
      ) {
        continue;
      }

      const xml = file.asText();
      if (!xml.includes(marker)) continue;

      // Locate the enclosing <w:p>...</w:p> that contains the marker
      const idx = xml.indexOf(marker);
      const paraStart = xml.lastIndexOf('<w:p', idx);
      const paraEnd = xml.indexOf('</w:p>', idx);

      if (paraStart !== -1 && paraEnd !== -1) {
        const newXml =
          xml.substring(0, paraStart) + drawingXml + xml.substring(paraEnd + 6);
        zip.file(fileName, newXml);
        logger.info(`Injected image "${imageName}" into ${fileName}`);
      } else {
        logger.warn(`Could not locate paragraph bounds for image marker in ${fileName}`);
      }
    }

    docPrCounter++;
  }

  // Write updated relationships file
  zip.file(relsPath, relsXml);
}

export function renderDocx(options: RenderOptions): Buffer {
  const { templateBuffer, data, images = {}, imageSizes = {} } = options;
  const imageTags = Object.keys(images);
  const zip = new PizZip(templateBuffer);

  // Step 1: replace {%tagName} paragraphs with safe text markers
  if (imageTags.length > 0) {
    const found = preprocessImageTags(zip, imageTags);
    for (const [tag, wasFound] of Object.entries(found)) {
      if (wasFound) {
        logger.info(`Found image placeholder {%${tag}} — replaced with marker`);
      } else {
        logger.warn(`Image placeholder {%${tag}} was not found in template XML`);
      }
    }
  }

  // Step 2: render text fields with docxtemplater (no image module needed)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  try {
    doc.render({ ...data });
  } catch (renderError) {
    const err = renderError as DocxtemplaterError;
    if (err.name === 'TemplateError' || err.name === 'RenderingError' || err.name === 'ScopeParserError') {
      let message: string;
      if (err.properties?.errors && err.properties.errors.length > 0) {
        const explanations = err.properties.errors
          .map((e) => e.properties?.explanation)
          .filter(Boolean) as string[];
        message = explanations.length > 0 ? explanations.join('; ') : (err.message ?? 'Template has errors');
      } else if (err.properties?.explanation) {
        message = err.properties.explanation;
      } else {
        message = err.message ?? 'Template has errors';
      }
      throw new TemplateRenderError(message);
    }
    throw renderError;
  }

  // Step 3: inject images via direct ZIP manipulation
  const renderedZip = doc.getZip();
  if (imageTags.length > 0) {
    postprocessInjectImages(renderedZip, images, imageSizes);
  }

  const output = renderedZip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;

  logger.info('DOCX rendered successfully');
  return output;
}
