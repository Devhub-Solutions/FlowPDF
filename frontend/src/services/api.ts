import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface RenderOptions {
  template?: File;
  data?: Record<string, unknown>;
  images?: Record<string, File>;
  apiKey?: string;
  html?: string;
  url?: string;
}

export interface AnalyzeResult {
  placeholders: string[];
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return headers;
}

export async function renderToPdf(options: RenderOptions): Promise<Blob> {
  const { template, data, images = {}, apiKey, html, url } = options;
  const form = new FormData();

  if (html) {
    form.append('html', html);
  } else if (url) {
    form.append('url', url);
  } else {
    if (template) form.append('template', template);
    if (data) form.append('data', JSON.stringify(data));
    for (const [key, file] of Object.entries(images)) {
      form.append(key, file);
    }
  }

  const response = await axios.post(`${API_BASE}/render`, form, {
    headers: { ...buildHeaders(apiKey) },
    responseType: 'blob',
  });

  return new Blob([response.data], { type: 'application/pdf' });
}

export async function previewPdf(options: RenderOptions): Promise<string> {
  const { template, data, images = {}, apiKey, html, url } = options;
  const form = new FormData();

  if (html) {
    form.append('html', html);
  } else if (url) {
    form.append('url', url);
  } else {
    if (template) form.append('template', template);
    if (data) form.append('data', JSON.stringify(data));
    for (const [key, file] of Object.entries(images)) {
      form.append(key, file);
    }
  }

  const response = await axios.post(`${API_BASE}/preview`, form, {
    headers: { ...buildHeaders(apiKey) },
  });

  return response.data.pdf as string;
}

export async function analyzePlaceholders(
  template: File,
  apiKey?: string
): Promise<AnalyzeResult> {
  const form = new FormData();
  form.append('template', template);

  const response = await axios.post(`${API_BASE}/analyze`, form, {
    headers: { ...buildHeaders(apiKey) },
  });

  return response.data as AnalyzeResult;
}

export async function combinePdfs(
  files: File[],
  order: string[] | null,
  apiKey?: string
): Promise<Blob> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  if (order) {
    form.append('order', JSON.stringify(order));
  }

  const response = await axios.post(`${API_BASE}/combine`, form, {
    headers: { ...buildHeaders(apiKey) },
    responseType: 'blob',
  });

  return new Blob([response.data], { type: 'application/pdf' });
}

export async function checkHealth(): Promise<{ status: string; gotenberg: string }> {
  const response = await axios.get(`${API_BASE}/health`);
  return response.data;
}

export interface ViolationLookupResult {
  found: boolean;
  data?: Record<string, string>;
  message?: string;
}

export interface InspectionLookupResult {
  found: boolean;
  data?: Record<string, string>;
  message?: string;
}

export async function lookupViolation(
  plate: string,
  vehicleType: string,
  apiKey?: string
): Promise<ViolationLookupResult> {
  const response = await axios.post(
    `${API_BASE}/lookup/violation`,
    { plate, vehicle_type: vehicleType },
    { headers: { 'Content-Type': 'application/json', ...buildHeaders(apiKey) } }
  );
  return response.data as ViolationLookupResult;
}

export async function lookupInspection(
  plate: string,
  vin: string,
  apiKey?: string
): Promise<InspectionLookupResult> {
  const response = await axios.post(
    `${API_BASE}/lookup/inspection`,
    { plate, vin },
    { headers: { 'Content-Type': 'application/json', ...buildHeaders(apiKey) } }
  );
  return response.data as InspectionLookupResult;
}
