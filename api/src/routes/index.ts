import { Router } from 'express';
import multer from 'multer';
import { checkApiKey } from '../middleware/auth';
import { renderPdf, previewPdf, analyzePlaceholders } from '../controllers/renderController';
import { checkGotenbergHealth } from '../services/gotenbergService';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

const multiUpload = upload.fields([
  { name: 'template', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
]);

// Health check
router.get('/health', async (_req, res) => {
  const gotenbergOk = await checkGotenbergHealth();
  res.json({
    status: 'ok',
    gotenberg: gotenbergOk ? 'ok' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

// Render PDF (returns binary PDF)
router.post('/render', checkApiKey, multiUpload, renderPdf);

// Preview PDF (returns base64)
router.post('/preview', checkApiKey, multiUpload, previewPdf);

// Analyze template placeholders
router.post('/analyze', checkApiKey, multiUpload, analyzePlaceholders);

export default router;
