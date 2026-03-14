import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function checkApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.FLOWPDF_API_KEY;

  if (!apiKey) {
    logger.warn('FLOWPDF_API_KEY not set, skipping auth check');
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const providedKey = authHeader.slice('Bearer '.length).trim();
  if (providedKey !== apiKey) {
    logger.warn(`Invalid API key attempt from ${req.ip}`);
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
