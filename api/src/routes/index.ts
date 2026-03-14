import { Router } from 'express';
import multer from 'multer';
import { checkApiKey } from '../middleware/auth';
import { renderPdf, previewPdf, analyzePlaceholders } from '../controllers/renderController';
import { combineToPdf } from '../controllers/combineController';
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

const MAX_COMBINE_FILES = 20;
const combineUpload = upload.array('files', MAX_COMBINE_FILES);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check API and Gotenberg status
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 gotenberg:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', async (_req, res) => {
  const gotenbergOk = await checkGotenbergHealth();
  res.json({
    status: 'ok',
    gotenberg: gotenbergOk ? 'ok' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @openapi
 * /render:
 *   post:
 *     summary: Render DOCX template to PDF
 *     description: |
 *       Render a DOCX template with data injection and return a PDF binary.
 *       Alternatively, convert HTML or a URL to PDF.
 *     tags: [Render]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               template:
 *                 type: string
 *                 format: binary
 *                 description: DOCX template file
 *               data:
 *                 type: string
 *                 description: JSON string of variable values
 *                 example: '{"name":"Nguyen Van A","amount":"5,000,000 VND"}'
 *               signature:
 *                 type: string
 *                 format: binary
 *                 description: Signature image
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Logo image
 *               image1:
 *                 type: string
 *                 format: binary
 *                 description: Additional image 1
 *               image2:
 *                 type: string
 *                 format: binary
 *                 description: Additional image 2
 *               image3:
 *                 type: string
 *                 format: binary
 *                 description: Additional image 3
 *               html:
 *                 type: string
 *                 description: HTML string to convert (skips template)
 *               url:
 *                 type: string
 *                 description: URL to convert to PDF (skips template)
 *     responses:
 *       200:
 *         description: PDF binary
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request
 *       401:
 *         description: Missing or invalid Authorization header
 *       403:
 *         description: Invalid API key
 *       500:
 *         description: Render failed
 */
router.post('/render', checkApiKey, multiUpload, renderPdf);

/**
 * @openapi
 * /preview:
 *   post:
 *     summary: Preview DOCX template as base64 PDF
 *     description: Same as /render but returns base64-encoded PDF in JSON response.
 *     tags: [Render]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               template:
 *                 type: string
 *                 format: binary
 *                 description: DOCX template file
 *               data:
 *                 type: string
 *                 description: JSON string of variable values
 *     responses:
 *       200:
 *         description: Base64 encoded PDF
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 pdf:
 *                   type: string
 *                   description: Base64 encoded PDF
 *                 size:
 *                   type: number
 *                   description: PDF size in bytes
 *       400:
 *         description: Bad request
 *       500:
 *         description: Preview failed
 */
router.post('/preview', checkApiKey, multiUpload, previewPdf);

/**
 * @openapi
 * /analyze:
 *   post:
 *     summary: Analyze template placeholders
 *     description: Extract all placeholders from a DOCX template file.
 *     tags: [Template]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               template:
 *                 type: string
 *                 format: binary
 *                 description: DOCX template file
 *     responses:
 *       200:
 *         description: List of placeholders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 placeholders:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["name", "amount", "date", "%signature"]
 *       400:
 *         description: No template file provided
 *       500:
 *         description: Analysis failed
 */
router.post('/analyze', checkApiKey, multiUpload, analyzePlaceholders);

/**
 * @openapi
 * /combine:
 *   post:
 *     summary: Combine multiple files into one PDF
 *     description: |
 *       Upload multiple files of different types (image, doc, docx, tif, tiff, pdf)
 *       and combine them into a single PDF in the specified order.
 *
 *       Supported file types: PDF, JPEG, PNG, TIFF, BMP, GIF, DOC, DOCX.
 *
 *       Each non-PDF file is converted to PDF first, then all are merged in order.
 *     tags: [Combine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to combine (max 20). Supported types - image (jpg, png, tif, tiff, bmp, gif), doc, docx, pdf.
 *               order:
 *                 type: string
 *                 description: |
 *                   JSON array of filenames specifying the merge order.
 *                   Files not listed are appended at the end.
 *                   If omitted, files are merged in upload order.
 *                 example: '["cover.pdf","scan.tiff","contract.docx","photo.jpg"]'
 *     responses:
 *       200:
 *         description: Combined PDF binary
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (no files, unsupported type, invalid order)
 *       401:
 *         description: Missing or invalid Authorization header
 *       403:
 *         description: Invalid API key
 *       500:
 *         description: Combine failed
 */
router.post('/combine', checkApiKey, combineUpload, combineToPdf);

export default router;
