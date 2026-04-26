import axios, { type AxiosResponse } from 'axios';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error: string | null;
  meta?: Record<string, any>;
}

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' }
});

const shouldRetry = (error: any) => {
  const networkError = !error?.response;
  const status = error?.response?.status;
  return networkError || status === 502 || status === 503 || status === 504;
};

async function requestWithRetry<T>(fn: () => Promise<AxiosResponse<ApiResponse<T>>>, retries = 1): Promise<ApiResponse<T>> {
  try {
    const response = await fn();
    return response.data;
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      return requestWithRetry(fn, retries - 1);
    }
    const message = error?.response?.data?.error || error?.message || 'Terjadi kesalahan jaringan.';
    throw new Error(message);
  }
}

export async function apiGet<T = any>(url: string, config = {}) {
  const payload = await requestWithRetry<T>(() => api.get<ApiResponse<T>>(url, config));
  if (!payload.success) throw new Error(payload.error || 'API error');
  return payload.data;
}

export async function apiPost<T = any>(url: string, body?: any, config = {}) {
  const payload = await requestWithRetry<T>(() => api.post<ApiResponse<T>>(url, body, config));
  if (!payload.success) throw new Error(payload.error || 'API error');
  return payload.data;
}

export async function apiDelete<T = any>(url: string, config = {}) {
  const payload = await requestWithRetry<T>(() => api.delete<ApiResponse<T>>(url, config));
  if (!payload.success) throw new Error(payload.error || 'API error');
  return payload.data;
}

export default api;
