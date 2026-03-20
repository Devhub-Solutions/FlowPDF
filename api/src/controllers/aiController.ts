import { Request, Response } from 'express';
import { forwardOcr, forwardDetect, forwardLookupViolation, forwardLookupInspection } from '../services/pythonAiService';
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

export async function lookupViolation(req: Request, res: Response): Promise<void> {
  const { plate, vehicle_type } = req.body as { plate?: string; vehicle_type?: string };

  if (!plate || !String(plate).trim()) {
    res.status(400).json({ error: 'plate is required' });
    return;
  }

  const vt = vehicle_type || 'motorbike';
  const validTypes = new Set(['car', 'motorbike', 'electricbike']);
  if (!validTypes.has(vt)) {
    res.status(400).json({ error: 'vehicle_type must be one of: car, electricbike, motorbike' });
    return;
  }

  try {
    logger.info(`Violation lookup request: plate=${plate}, vehicle_type=${vt}`);
    const result = await forwardLookupViolation(String(plate).trim(), vt);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Violation lookup controller error: ${message}`);
    res.status(500).json({ error: message });
  }
}

export async function lookupInspection(req: Request, res: Response): Promise<void> {
  const { plate, vin } = req.body as { plate?: string; vin?: string };

  if (!plate || !String(plate).trim()) {
    res.status(400).json({ error: 'plate is required' });
    return;
  }

  if (!vin || !String(vin).trim()) {
    res.status(400).json({ error: 'vin is required' });
    return;
  }

  try {
    logger.info(`Inspection lookup request: plate=${plate}`);
    const result = await forwardLookupInspection(String(plate).trim(), String(vin).trim());
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Inspection lookup controller error: ${message}`);
    res.status(500).json({ error: message });
  }
}
