import { Router } from 'express';
import multer from 'multer';
import { checkApiKey } from '../middleware/auth';
import { renderPdf, previewPdf, analyzePlaceholders } from '../controllers/renderController';
import { combineToPdf } from '../controllers/combineController';
import { checkGotenbergHealth } from '../services/gotenbergService';
import { checkPythonAiHealth } from '../services/pythonAiService';
import { ocrImage, detectObjects } from '../controllers/aiController';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 20,
  },
});

const multiUpload = upload.any();

const MAX_COMBINE_FILES = 20;
const combineUpload = upload.array('files', MAX_COMBINE_FILES);
const aiImageUpload = upload.single('image');

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
  const pythonAiOk = await checkPythonAiHealth();
  res.json({
    status: 'ok',
    gotenberg: gotenbergOk ? 'ok' : 'unavailable',
    pythonAi: pythonAiOk ? 'ok' : 'unavailable',
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
 *
 *       For DOCX rendering, image placeholders use the `{%imageKey}` syntax.
 *       Any uploaded multipart field whose name matches an image placeholder key
 *       is treated as an image, normalized to PNG with Sharp, and injected into the DOCX.
 *
 *       Optional image size configuration can be provided in the `data` JSON using
 *       `imageOptions` or `_imageOptions`, for example:
 *       `{"imageOptions":{"signature":{"width":180,"height":60},"logo":{"w":140,"h":70}}}`
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
 *                 description: JSON string of variable values and optional image sizing config
 *                 example: '{"name":"Nguyen Van A","amount":"5,000,000 VND","imageOptions":{"signature":{"width":180,"height":60},"logo":{"w":140,"h":70}}}'
 *               html:
 *                 type: string
 *                 description: HTML string to convert (skips template)
 *               url:
 *                 type: string
 *                 description: URL to convert to PDF (skips template)
 *             additionalProperties:
 *               type: string
 *               format: binary
 *               description: Image files matching template placeholders (for example signature, logo, stamp, avatar). Any image format supported by Sharp may be uploaded.
 *     responses:
 *       200:
 *         description: PDF binary
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (invalid JSON, missing template, unsupported image data, missing placeholder)
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
 *     description: |
 *       Same as /render but returns base64-encoded PDF in JSON response.
 *       Alternatively, convert HTML or a URL to PDF.
 *
 *       Supports the same image upload behavior as `/render`, including:
 *       - image placeholders in the form `{%imageKey}`
 *       - any image format supported by Sharp
 *       - optional `imageOptions` or `_imageOptions` config in the `data` JSON
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
 *                 description: JSON string of variable values and optional image sizing config
 *                 example: '{"name":"Nguyen Van A","imageOptions":{"signature":{"width":180,"height":60}}}'
 *               html:
 *                 type: string
 *                 description: HTML string to convert (skips template)
 *               url:
 *                 type: string
 *                 description: URL to convert to PDF (skips template)
 *             additionalProperties:
 *               type: string
 *               format: binary
 *               description: Image files matching template placeholders. Any image format supported by Sharp may be uploaded.
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
 *         description: Bad request (invalid JSON, missing template, unsupported image data, missing placeholder)
 *       401:
 *         description: Missing or invalid Authorization header
 *       403:
 *         description: Invalid API key
 *       500:
 *         description: Preview failed
 */
router.post('/preview', checkApiKey, multiUpload, previewPdf);

/**
 * @openapi
 * /analyze:
 *   post:
 *     summary: Analyze template placeholders
 *     description: Extract all placeholders from a DOCX template file, including image placeholders in the form `%imageKey`.
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
 *       401:
 *         description: Missing or invalid Authorization header
 *       403:
 *         description: Invalid API key
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

/**
 * @openapi
 * /ocr:
 *   post:
 *     summary: Extract Vietnamese text from an image (VietOCR)
 *     description: |
 *       Upload an image file and receive the extracted text using the VietOCR
 *       deep-learning model. The AI service runs internally; this endpoint acts
 *       as a proxy so callers only need to reach the main FlowPDF API port.
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to extract text from (JPEG, PNG, BMP, TIFF, …)
 *     responses:
 *       200:
 *         description: Extracted text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                   example: "Cộng hòa xã hội chủ nghĩa Việt Nam"
 *                 filename:
 *                   type: string
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Missing or invalid Authorization header
 *       403:
 *         description: Invalid API key
 *       500:
 *         description: OCR failed
 */
router.post('/ocr', checkApiKey, aiImageUpload, ocrImage);

/**
 * @openapi
 * /detect:
 *   post:
 *     summary: Detect objects in an image (YOLO)
 *     description: |
 *       Upload an image file and receive a list of detected objects using the
 *       YOLO model (ultralytics). Each detection includes class name, confidence
 *       score, and bounding-box coordinates [x1, y1, x2, y2].
 *       The AI service runs internally; this endpoint proxies the request so
 *       callers only need to reach the main FlowPDF API port.
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to analyse (JPEG, PNG, BMP, TIFF, …)
 *     responses:
 *       200:
 *         description: Detection results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 detections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       class:
 *                         type: string
 *                         example: person
 *                       confidence:
 *                         type: number
 *                         example: 0.92
 *                       bbox:
 *                         type: array
 *                         items:
 *                           type: number
 *                         example: [120.5, 80.2, 340.1, 460.7]
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 filename:
 *                   type: string
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Missing or invalid Authorization header
 *       403:
 *         description: Invalid API key
 *       500:
 *         description: Detection failed
 */
router.post('/detect', checkApiKey, aiImageUpload, detectObjects);

export default router;
