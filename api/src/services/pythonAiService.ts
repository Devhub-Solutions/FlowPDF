import axios, { AxiosError } from 'axios';
import http from 'http';
import https from 'https';
import FormData from 'form-data';
import { logger } from '../utils/logger';

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';
const PYTHON_AI_TIMEOUT_MS = (() => {
  const raw = process.env.PYTHON_AI_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 120_000;
  }
  return parsed;
})();

const pythonAiClient = axios.create({
  baseURL: PYTHON_AI_URL,
  timeout: PYTHON_AI_TIMEOUT_MS,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

function getAxiosErrorMessage(error: AxiosError): string {
  const status = error.response?.status;
  const data = error.response?.data;

  if (!status) {
    return error.message;
  }

  if (Buffer.isBuffer(data)) {
    return `status=${status}, body=${data.toString('utf-8')}`;
  }

  if (typeof data === 'string') {
    return `status=${status}, body=${data}`;
  }

  if (data && typeof data === 'object') {
    return `status=${status}, body=${JSON.stringify(data)}`;
  }

  return `status=${status}, message=${error.message}`;
}

export async function forwardOcr(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string
): Promise<Record<string, unknown>> {
  try {
    const form = new FormData();
    form.append('file', fileBuffer, { filename, contentType: mimetype });

    const response = await pythonAiClient.post<Record<string, unknown>>(
      '/ocr',
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  } catch (error) {
    const details = getAxiosErrorMessage(error as AxiosError);
    logger.error(`Python AI OCR error: ${details}`);
    throw new Error(`OCR request failed: ${details}`);
  }
}

export async function forwardDetect(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string
): Promise<Record<string, unknown>> {
  try {
    const form = new FormData();
    form.append('file', fileBuffer, { filename, contentType: mimetype });

    const response = await pythonAiClient.post<Record<string, unknown>>(
      '/detect',
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  } catch (error) {
    const details = getAxiosErrorMessage(error as AxiosError);
    logger.error(`Python AI detect error: ${details}`);
    throw new Error(`Detect request failed: ${details}`);
  }
}

export async function forwardLookupViolation(
  plate: string,
  vehicleType: string
): Promise<Record<string, unknown>> {
  try {
    const response = await pythonAiClient.post<Record<string, unknown>>(
      '/lookup/violation',
      { plate, vehicle_type: vehicleType },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    const details = getAxiosErrorMessage(error as AxiosError);
    logger.error(`Python AI violation lookup error: ${details}`);
    throw new Error(`Violation lookup request failed: ${details}`);
  }
}

export async function forwardLookupInspection(
  plate: string,
  vin: string
): Promise<Record<string, unknown>> {
  try {
    const response = await pythonAiClient.post<Record<string, unknown>>(
      '/lookup/inspection',
      { plate, vin },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    const details = getAxiosErrorMessage(error as AxiosError);
    logger.error(`Python AI inspection lookup error: ${details}`);
    throw new Error(`Inspection lookup request failed: ${details}`);
  }
}

export async function checkPythonAiHealth(): Promise<boolean> {
  try {
    const response = await pythonAiClient.get('/health', { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}
