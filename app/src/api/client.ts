import { config } from '../lib/config';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export type AuthHeaderProvider = () => Promise<Record<string, string>>;

export interface ApiClient {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
  del: (path: string) => Promise<void>;
  upload: <T>(path: string, form: FormData) => Promise<T>;
}

export function createApiClient(getAuthHeaders: AuthHeaderProvider): ApiClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const auth = await getAuthHeaders();
    const res = await fetch(`${config.apiUrl}/api/v1${path}`, {
      ...init,
      headers: { ...auth, ...(init.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let details: unknown;
      try {
        const body = await res.json();
        message = body.error ?? message;
        details = body.details;
      } catch {
        // non-JSON error body
      }
      throw new ApiRequestError(res.status, message, details);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    get: (path) => request(path),
    post: (path, body) =>
      request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    patch: (path, body) =>
      request(path, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    del: (path) => request(path, { method: 'DELETE' }),
    upload: (path, form) => request(path, { method: 'POST', body: form }),
  };
}
