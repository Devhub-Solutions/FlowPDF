import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ImageModule = require('docxtemplater-image-module-free');
import { logger } from '../utils/logger';

export interface RenderOptions {
  templateBuffer: Buffer;
  data: Record<string, unknown>;
  images?: Record<string, Buffer>;
}

export function extractPlaceholders(templateBuffer: Buffer): string[] {
  try {
    const zip = new PizZip(templateBuffer);
    const content = zip.files['word/document.xml']?.asText() || '';

    const normalRegex = /\{([^{}%#/^@*]+)\}/g;
    const imageRegex = /\{%([^{}]+)\}/g;
    const placeholders = new Set<string>();
    let match;

    while ((match = normalRegex.exec(content)) !== null) {
      placeholders.add(match[1].trim());
    }
    while ((match = imageRegex.exec(content)) !== null) {
      placeholders.add('%' + match[1].trim());
    }

    logger.info(`Extracted ${placeholders.size} placeholders`);
    return Array.from(placeholders);
  } catch (error) {
    logger.error('Failed to extract placeholders', error);
    return [];
  }
}

export function renderDocx(options: RenderOptions): Buffer {
  const { templateBuffer, data, images = {} } = options;
  const zip = new PizZip(templateBuffer);
  const hasImages = Object.keys(images).length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules: any[] = [];

  if (hasImages) {
    const imageModule = new ImageModule({
      centered: false,
      fileType: 'docx',
      getImage(_tagValue: string, tagName: string): Buffer | null {
        return images[tagName] ?? null;
      },
      getSize(_img: Buffer, _tagValue: string, tagName: string): [number, number] {
        if (tagName === 'signature') return [150, 50];
        if (tagName === 'logo') return [120, 60];
        return [150, 100];
      },
    });
    modules.push(imageModule);
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules,
  });

  doc.render({ ...data });

  const output = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;

  logger.info('DOCX rendered successfully');
  return output;
}
