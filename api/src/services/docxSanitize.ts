import PizZip from 'pizzip';
import { logger } from '../utils/logger';

/**
 * Strip duplicate xml:space attributes from rendered DOCX.
 * Docxtemplater adds xml:space="preserve" to <w:t> elements,
 * but if the template already had xml:space='preserve', LibreOffice
 * rejects the DOCX with "malformed document" error.
 */
export function sanitizeDocxXml(docxBuffer: Buffer): Buffer {
  try {
    const zip = new PizZip(docxBuffer);
    let totalFixed = 0;

    for (const [name, file] of Object.entries(zip.files)) {
      if (!name.endsWith('.xml') || name.includes('_rels') || name.includes('media')) continue;

      const xml = file.asText();
      // Fix: xml:space='preserve' xml:space="preserve"  (single then double)
      // Fix: xml:space="preserve" xml:space='preserve'  (double then single)
      const fixed = xml
        .replace(/xml:space=['"]preserve['"]\s+xml:space=['"]preserve['"]/g, 'xml:space="preserve"')
        // Also fix double-quoted duplicates
        .replace(/xml:space="preserve"\s+xml:space="preserve"/g, 'xml:space="preserve"');

      if (fixed !== xml) {
        const count = (xml.match(/xml:space=['"]preserve['"]\s+xml:space=['"]preserve['"]/g) || []).length;
        totalFixed += count;
        zip.file(name, fixed);
      }
    }

    if (totalFixed > 0) {
      logger.info(`Sanitized ${totalFixed} duplicate xml:space attributes in DOCX`);
    }

    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  } catch (err) {
    logger.warn('docxSanitize failed, returning original buffer', err);
    return docxBuffer;
  }
}
