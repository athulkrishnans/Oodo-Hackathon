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
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders ?? {}),
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
  post: <T>(path: string, body: unknown, headers?: Record<string, string>) => request<T>('POST', path, body, headers),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// Current user decoded from the JWT claim (sub/role/email — see middleware/auth.ts).
// Used for client-side role gating of write UI (on top of the backend requireRole gate).
export interface CurrentUser {
  sub: string;
  role: string | null;
  email: string;
}

export function getCurrentUser(): CurrentUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload));
    return {
      sub: decoded.sub,
      role: decoded.role ?? null,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}
