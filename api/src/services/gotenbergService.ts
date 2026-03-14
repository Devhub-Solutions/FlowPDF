import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';

const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:3000';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`Gotenberg convert attempt ${attempt}/${MAX_RETRIES}`);

      const form = new FormData();
      form.append('files', docxBuffer, {
        filename: 'document.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const response = await axios.post(
        `${GOTENBERG_URL}/forms/libreoffice/convert`,
        form,
        {
          headers: {
            ...form.getHeaders(),
          },
          responseType: 'arraybuffer',
          timeout: 60000,
        }
      );

      logger.info('Gotenberg conversion successful');
      return Buffer.from(response.data);
    } catch (error) {
      lastError = error as Error;
      const axiosError = error as AxiosError;
      logger.warn(
        `Gotenberg attempt ${attempt} failed: ${axiosError.message}`
      );

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(`Gotenberg conversion failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

export async function convertHtmlToPdf(html: string): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const form = new FormData();
      form.append('files', Buffer.from(html, 'utf-8'), {
        filename: 'index.html',
        contentType: 'text/html',
      });

      const response = await axios.post(
        `${GOTENBERG_URL}/forms/chromium/convert/html`,
        form,
        {
          headers: { ...form.getHeaders() },
          responseType: 'arraybuffer',
          timeout: 60000,
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      lastError = error as Error;
      logger.warn(`HTML convert attempt ${attempt} failed`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(`HTML conversion failed: ${lastError?.message}`);
}

export async function convertUrlToPdf(url: string): Promise<Buffer> {
  const response = await axios.post(
    `${GOTENBERG_URL}/forms/chromium/convert/url`,
    { url },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 60000,
    }
  );

  return Buffer.from(response.data);
}

export async function checkGotenbergHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${GOTENBERG_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}
