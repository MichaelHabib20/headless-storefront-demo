import { ApiError, type ApiErrorKind } from './errors';

export type Locale = 'en' | 'ar';

export interface ClientOptions {
  /** Backend base URL, without `/api/customer`. */
  baseUrl: string;
  /** Store api-key. Identifies the tenant. Keep it server-side. */
  apiKey?: string;
  locale?: Locale;
  /** Customer JWT, when signed in. */
  token?: string;
  fetch?: typeof fetch;
}

/**
 * The legacy customer API envelope. The HTTP status is almost always 200;
 * the real outcome is `code`.
 */
export interface Envelope<T = unknown> {
  code: number;
  message?: string;
  message_ar?: string;
  data?: T;
  errors?: { errorMessage?: string; errorDetails?: unknown };
}

export interface Client {
  readonly locale: Locale;
  request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Envelope<T>>;
  withToken(token: string | undefined): Client;
}

const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  validation: 'Please check the highlighted fields.',
  invalid_credentials: 'The details you entered are not correct.',
  account_deactivated: 'This account has been deactivated.',
  social_account_only: 'This account uses social sign-in. Please sign in with it.',
  not_allowed: 'This account cannot sign in here.',
  phone_taken: 'This phone number is already registered.',
  signup_disabled: 'Sign-up is currently closed for this store.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
  store_unavailable: 'The store is temporarily unavailable.',
  not_found: 'This page could not be found.',
  invalid_response: 'The store returned an unexpected response.',
  server: 'Something went wrong on our side. Please try again.',
  network: 'Could not reach the store. Check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * Picks the message to show. The backend sometimes returns an untranslated
 * key (e.g. `mobile.errorIncorrectPassword`); those fall back to our own text.
 */
export function messageFor(env: Pick<Envelope, 'message' | 'message_ar'>, locale: Locale, kind: ApiErrorKind): string {
  const message = locale === 'ar' && env.message_ar ? env.message_ar : env.message;
  if (!message || /^[a-z_]+\.[A-Za-z_]+$/.test(message)) return FALLBACK_MESSAGES[kind];
  return message;
}

function toFieldErrors(details: unknown): Record<string, string[]> {
  if (!details || typeof details !== 'object') return {};
  const result: Record<string, string[]> = {};
  for (const [field, value] of Object.entries(details as Record<string, unknown>)) {
    if (Array.isArray(value)) result[field] = value.map(String);
    else if (typeof value === 'string') result[field] = [value];
  }
  return result;
}

export function createClient(options: ClientOptions): Client {
  const { baseUrl, apiKey, locale = 'en', token } = options;
  const doFetch = options.fetch ?? fetch;
  const root = `${baseUrl.replace(/\/+$/, '')}/api/customer/`;

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Envelope<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      lang: locale === 'ar' ? '2' : '1',
      'device-type': 'web',
      device: '3',
    };
    if (apiKey) headers['api-key'] = apiKey;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await doFetch(root + path.replace(/^\/+/, ''), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
    } catch (cause) {
      throw new ApiError('network', 0, FALLBACK_MESSAGES.network, {}, cause);
    }

    let env: Envelope<T>;
    try {
      env = (await res.json()) as Envelope<T>;
    } catch (cause) {
      throw new ApiError('server', res.status, FALLBACK_MESSAGES.server, {}, cause);
    }
    if (typeof env?.code !== 'number') env = { ...env, code: res.status };

    // Codes that mean the same thing on every endpoint.
    switch (env.code) {
      case 423:
        throw new ApiError('validation', 423, messageFor(env, locale, 'validation'), toFieldErrors(env.errors?.errorDetails));
      case 429:
        throw new ApiError('rate_limited', 429, messageFor(env, locale, 'rate_limited'));
      case 700:
        throw new ApiError('store_unavailable', 700, messageFor(env, locale, 'store_unavailable'));
    }
    if (env.code >= 500) throw new ApiError('server', env.code, FALLBACK_MESSAGES.server);

    // Everything else is endpoint-specific and handled by the domain modules.
    return env;
  }

  return {
    locale,
    request,
    withToken: (next) => createClient({ ...options, token: next }),
  };
}

/** For codes a domain module did not expect. */
export function unexpected(env: Envelope, locale: Locale): ApiError {
  return new ApiError('unknown', env.code, messageFor(env, locale, 'unknown'));
}
