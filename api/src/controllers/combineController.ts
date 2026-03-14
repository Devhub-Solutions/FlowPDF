import { Request, Response } from 'express';
import { convertFileToPdf, mergePdfs } from '../services/gotenbergService';
import { logger } from '../utils/logger';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const SUPPORTED_MIMETYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/tiff': '.tif',
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const SUPPORTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.gif', '.doc', '.docx'];

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : '';
}

function isFileSupported(file: MulterFile): boolean {
  if (SUPPORTED_MIMETYPES[file.mimetype]) return true;
  const ext = getFileExtension(file.originalname);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export async function combineToPdf(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as MulterFile[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided. Upload files using the "files" field.' });
      return;
    }

    // Validate all files are supported
    for (const file of files) {
      if (!isFileSupported(file)) {
        res.status(400).json({
          error: `Unsupported file type: ${file.originalname} (${file.mimetype}). Supported types: image (jpg, png, tif, tiff, bmp, gif), doc, docx, pdf`,
        });
        return;
      }
    }

    // Parse order if provided
    let orderedFiles = [...files];
    if (req.body.order) {
      try {
        const order: string[] = JSON.parse(req.body.order as string);
        const fileMap = new Map<string, MulterFile>();
        for (const file of files) {
          fileMap.set(file.originalname, file);
        }

        const reordered: MulterFile[] = [];
        for (const name of order) {
          const file = fileMap.get(name);
          if (file) {
            reordered.push(file);
            fileMap.delete(name);
          }
        }
        // Append any files not mentioned in the order
        for (const file of fileMap.values()) {
          reordered.push(file);
        }
        orderedFiles = reordered;
      } catch {
        res.status(400).json({ error: 'Invalid JSON in order field. Expected an array of filenames.' });
        return;
      }
    }

    logger.info(`Combining ${orderedFiles.length} files into PDF`);

    // Convert each file to PDF
    const pdfBuffers: Buffer[] = [];
    for (const file of orderedFiles) {
      const ext = getFileExtension(file.originalname);
      const isPdf = file.mimetype === 'application/pdf' || ext === '.pdf';

      if (isPdf) {
        pdfBuffers.push(file.buffer);
        logger.info(`File "${file.originalname}" is already PDF, skipping conversion`);
      } else {
        logger.info(`Converting "${file.originalname}" to PDF...`);
        const pdfBuffer = await convertFileToPdf(file.buffer, file.originalname, file.mimetype);
        pdfBuffers.push(pdfBuffer);
        logger.info(`Converted "${file.originalname}" to PDF (${pdfBuffer.length} bytes)`);
      }
    }

    // Merge all PDFs
    let finalPdf: Buffer;
    if (pdfBuffers.length === 1) {
      finalPdf = pdfBuffers[0];
    } else {
      logger.info(`Merging ${pdfBuffers.length} PDFs...`);
      finalPdf = await mergePdfs(pdfBuffers);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="combined.pdf"');
    res.setHeader('Content-Length', finalPdf.length);
    res.send(finalPdf);

    logger.info(`Combined PDF generated successfully, size: ${finalPdf.length} bytes`);
  } catch (error) {
    const err = error as Error;
    logger.error('Combine failed', err);
    res.status(500).json({ error: err.message || 'Combine failed' });
  }
}
