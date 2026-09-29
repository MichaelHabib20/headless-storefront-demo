import { ApiError } from '../errors';
import type { Locale } from './types';

export interface StorefrontClientOptions {
  /** Backend base URL, without `/api/customer/v3`. */
  baseUrl: string;
  /** Store api-key (tenant). Server-side only. */
  apiKey?: string;
  fetch?: typeof fetch;
  /** Seconds a response may be reused by the framework cache (Next.js `revalidate`). */
  revalidate?: number;
  timeoutMs?: number;
}

export interface StorefrontClient {
  get<T>(path: string, locale: Locale): Promise<T>;
}

const MESSAGES = {
  network: 'Could not reach the store. Check your connection and try again.',
  server: 'Something went wrong on our side. Please try again.',
  not_found: 'This page could not be found.',
  invalid_response: 'The store returned an unexpected response.',
} as const;

/**
 * Thin HTTP layer over `/api/customer/v3`: success is `{data}` with 200, failure is
 * `{error: {code, message}}` with a real status. Every failure becomes an ApiError.
 */
export function createStorefrontClient(options: StorefrontClientOptions): StorefrontClient {
  const root = `${options.baseUrl.replace(/\/+$/, '')}/api/customer/v3/`;
  const doFetch = options.fetch ?? fetch;

  async function get<T>(path: string, locale: Locale): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': locale };
    if (options.apiKey) headers['api-key'] = options.apiKey;

    const init: RequestInit & { next?: { revalidate: number } } = {
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    };
    if (options.revalidate !== undefined) init.next = { revalidate: options.revalidate };

    let res: Response;
    try {
      res = await doFetch(root + path.replace(/^\/+/, ''), init);
    } catch (cause) {
      throw new ApiError('network', 0, MESSAGES.network, {}, cause);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch (cause) {
      throw new ApiError('invalid_response', res.status, MESSAGES.invalid_response, {}, cause);
    }

    if (!res.ok) {
      const kind = res.status === 404 ? 'not_found' : res.status === 429 ? 'rate_limited' : 'server';
      const message = (body as { error?: { message?: string } })?.error?.message;
      throw new ApiError(kind, res.status, message || MESSAGES[kind === 'rate_limited' ? 'server' : kind]);
    }
    if (!body || typeof body !== 'object' || !('data' in body)) {
      throw new ApiError('invalid_response', res.status, MESSAGES.invalid_response);
    }
    return (body as { data: T }).data;
  }

  return { get };
}
