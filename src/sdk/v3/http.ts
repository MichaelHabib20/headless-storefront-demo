import { ApiError, type ApiErrorKind } from '../errors';
import type { Locale } from './types';

export interface StorefrontClientOptions {
  /** Backend base URL, without `/api/customer/v3`. */
  baseUrl: string;
  /** Store api-key (tenant). Server-side only. */
  apiKey?: string;
  fetch?: typeof fetch;
  /** Seconds a GET response may be reused by the framework cache (Next.js `revalidate`). Ignored for personal data. */
  revalidate?: number;
  timeoutMs?: number;
}

export interface RequestOptions {
  locale: Locale;
  /** Shopper token (customer or guest). Personal requests are never cached. */
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface StorefrontClient {
  get<T>(path: string, locale: Locale): Promise<T>;
  request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options: RequestOptions): Promise<T>;
}

const MESSAGES = {
  network: 'Could not reach the store. Check your connection and try again.',
  server: 'Something went wrong on our side. Please try again.',
  not_found: 'This page could not be found.',
  invalid_response: 'The store returned an unexpected response.',
} as const;

/** v3 error codes → SDK error kinds. Unknown codes keep a generic kind by HTTP status. */
const ERROR_KINDS: Record<string, ApiErrorKind> = {
  unauthenticated: 'unauthenticated',
  not_found: 'not_found',
  validation_failed: 'validation',
  quantity_not_allowed: 'quantity_not_allowed',
  compare_full: 'compare_full',
  rate_limited: 'rate_limited',
  server_error: 'server',
};

function kindFor(status: number, code: string | undefined): ApiErrorKind {
  if (code && ERROR_KINDS[code]) return ERROR_KINDS[code];
  if (status === 401) return 'unauthenticated';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  return 'server';
}

/**
 * Thin HTTP layer over `/api/customer/v3`: success is `{data}` with 2xx, failure is
 * `{error: {code, message, fields?}}` with a real status. Every failure becomes an ApiError.
 */
export function createStorefrontClient(options: StorefrontClientOptions): StorefrontClient {
  const root = `${options.baseUrl.replace(/\/+$/, '')}/api/customer/v3/`;
  const doFetch = options.fetch ?? fetch;

  async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, { locale, token, body, query }: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': locale };
    if (options.apiKey) headers['api-key'] = options.apiKey;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const init: RequestInit & { next?: { revalidate: number } } = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    };
    if (method === 'GET' && !token && options.revalidate !== undefined) init.next = { revalidate: options.revalidate };
    else init.cache = 'no-store';

    const search = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    let res: Response;
    try {
      res = await doFetch(root + path.replace(/^\/+/, '') + (search ? `?${search}` : ''), init);
    } catch (cause) {
      throw new ApiError('network', 0, MESSAGES.network, {}, cause);
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch (cause) {
      throw new ApiError('invalid_response', res.status, MESSAGES.invalid_response, {}, cause);
    }

    if (!res.ok) {
      const error = (payload as { error?: { code?: string; message?: string; fields?: Record<string, string[]> } })?.error;
      const kind = kindFor(res.status, error?.code);
      throw new ApiError(kind, res.status, error?.message || MESSAGES[kind === 'not_found' ? 'not_found' : 'server'], error?.fields ?? {});
    }
    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
      throw new ApiError('invalid_response', res.status, MESSAGES.invalid_response);
    }
    return (payload as { data: T }).data;
  }

  return {
    request,
    get: <T>(path: string, locale: Locale) => request<T>('GET', path, { locale }),
  };
}
