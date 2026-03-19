import { Request, Response } from 'express';
import { forwardOcr, forwardDetect } from '../services/pythonAiService';
import { logger } from '../utils/logger';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

type MulterRequest = Request & { file?: MulterFile };

export async function ocrImage(req: MulterRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No image file provided (field name: image)' });
    return;
  }

  try {
    logger.info(`OCR request for file: ${file.originalname}`);
    const result = await forwardOcr(file.buffer, file.originalname, file.mimetype);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`OCR controller error: ${message}`);
    res.status(500).json({ error: message });
  }
}

export async function detectObjects(req: MulterRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No image file provided (field name: image)' });
    return;
  }

  try {
    logger.info(`Detect request for file: ${file.originalname}`);
    const result = await forwardDetect(file.buffer, file.originalname, file.mimetype);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Detect controller error: ${message}`);
    res.status(500).json({ error: message });
  }
}
