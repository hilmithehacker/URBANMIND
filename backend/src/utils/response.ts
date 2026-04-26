export interface ApiResponse<T = any> {
  success: true;
  data: T;
  error: null;
  meta?: Record<string, any>;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: string;
  meta?: Record<string, any>;
}

export function successResponse<T = any>(data: T, meta: Record<string, any> = {}): ApiResponse<T> {
  return { success: true, data, error: null, meta };
}

export function errorResponse(message = 'Terjadi kesalahan server', meta: Record<string, any> = {}): ApiErrorResponse {
  return { success: false, data: null, error: message, meta };
}
