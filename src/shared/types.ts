// src/shared/types.ts
// Shared TypeScript types used across all modules.
// The ApiResponse<T> envelope — every endpoint returns this shape.

export type ApiResponse<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | { success: false; error: ApiError };

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiError {
  code: string;      // kebab-case, module-prefixed e.g. dispatch/vehicle-already-assigned
  message: string;
  details?: unknown;
}

// Convenience helpers for building responses
export function successResponse<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function errorResponse(code: string, message: string, details?: unknown): ApiResponse<never> {
  return { success: false, error: { code, message, details } };
}
