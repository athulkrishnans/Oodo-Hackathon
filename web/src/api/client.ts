// web/src/api/client.ts
// Thin fetch wrapper — attaches Bearer token, unwraps ApiResponse envelope.
// Used by all page-level data fetching hooks.

const BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('transitops_token');
}

export function setToken(token: string): void {
  localStorage.setItem('transitops_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('transitops_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json();

  if (!json.success) {
    throw new ApiError(res.status, json.error.code, json.error.message, json.error.details);
  }

  return json as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
