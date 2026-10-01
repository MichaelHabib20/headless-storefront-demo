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
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Extra request headers the contract asks for (e.g. `Idempotency-Key`). They never replace the standard ones. */
  headers?: Record<string, string>;
}

export interface UploadOptions {
  locale: Locale;
  token?: string | null;
  /** The file goes in the `file` field. */
  form: FormData;
}

export interface StorefrontClient {
  get<T>(path: string, locale: Locale): Promise<T>;
  request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options: RequestOptions): Promise<T>;
  /** multipart/form-data POST (file uploads). */
  upload<T>(path: string, options: UploadOptions): Promise<T>;
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
  already_available: 'already_available',
  total_changed: 'total_changed',
  checkout_incomplete: 'checkout_incomplete',
  payment_change_needs_consent: 'payment_change_needs_consent',
  order_in_progress: 'order_in_progress',
  cannot_cancel: 'cannot_cancel',
  guest_checkout_disabled: 'guest_checkout_disabled',
  phone_in_use: 'phone_in_use',
  payment_provider_error: 'payment_provider_error',
  // orders extras
  already_rated: 'already_rated',
  cannot_rate: 'cannot_rate',
  feature_disabled: 'feature_disabled',
  // auth and account
  invalid_credentials: 'invalid_credentials',
  account_deactivated: 'account_deactivated',
  social_account_only: 'social_account_only',
  signup_disabled: 'signup_disabled',
  provider_error: 'provider_error',
  code_expired: 'code_expired',
  too_many_attempts: 'too_many_attempts',
  invalid_code: 'invalid_code',
  sms_unavailable: 'sms_unavailable',
  phone_already_verified: 'phone_already_verified',
  email_in_use: 'email_in_use',
  wrong_password: 'wrong_password',
  // shell: the store is switched off (maintenance); the message is the merchant's
  store_unavailable: 'store_unavailable',
  // account extras: a prescription cannot be sent yet (the form's blockers)
  prescription_blocked: 'prescription_blocked',
  // account extras: a reward cannot be redeemed now (the message says why)
  cannot_redeem: 'cannot_redeem',
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

  function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, { locale, token, body, query, headers }: RequestOptions): Promise<T> {
    return send<T>(method, path, { locale, token, query, extraHeaders: headers, body: body === undefined ? undefined : JSON.stringify(body), json: body !== undefined });
  }

  function upload<T>(path: string, { locale, token, form }: UploadOptions): Promise<T> {
    return send<T>('POST', path, { locale, token, body: form, json: false });
  }

  interface Sending {
    locale: Locale;
    token?: string | null;
    query?: RequestOptions['query'];
    body?: BodyInit;
    json: boolean;
    extraHeaders?: Record<string, string>;
  }

  async function send<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, { locale, token, query, body, json, extraHeaders }: Sending): Promise<T> {
    // device-type: web → the store applies its website rules (e.g. default area for new guests).
    const headers: Record<string, string> = { ...extraHeaders, Accept: 'application/json', 'Accept-Language': locale, 'device-type': 'web' };
    if (options.apiKey) headers['api-key'] = options.apiKey;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json) headers['Content-Type'] = 'application/json';

    const init: RequestInit & { next?: { revalidate: number } } = {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    };
    if (method === 'GET' && !token && options.revalidate !== undefined) init.next = { revalidate: options.revalidate };
    else init.cache = 'no-store';

    const search = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString() : '';
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
      const { error, ...details } = (payload ?? {}) as { error?: { code?: string; message?: string; fields?: Record<string, string[]> } } & Record<string, unknown>;
      const kind = kindFor(res.status, error?.code);
      throw new ApiError(kind, res.status, error?.message || MESSAGES[kind === 'not_found' ? 'not_found' : 'server'], error?.fields ?? {}, undefined, details);
    }
    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
      throw new ApiError('invalid_response', res.status, MESSAGES.invalid_response);
    }
    return (payload as { data: T }).data;
  }

  return {
    request,
    upload,
    get: <T>(path: string, locale: Locale) => request<T>('GET', path, { locale }),
  };
}
