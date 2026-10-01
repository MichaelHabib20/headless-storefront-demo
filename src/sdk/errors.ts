/**
 * Every failure the SDK can report, by name. The v3 API answers real HTTP statuses with
 * `{error: {code, message, fields?}}`; the SDK maps `code` to a kind so storefront code
 * never branches on numbers or raw strings. `message` is the backend's, localized.
 */
export type ApiErrorKind =
  | 'validation'
  | 'rate_limited'
  | 'store_unavailable'
  | 'server'
  | 'network'
  | 'not_found'
  | 'invalid_response'
  | 'unauthenticated'
  | 'quantity_not_allowed'
  | 'compare_full'
  | 'conflict'
  // shopping, checkout and orders (v3 error codes, same names)
  | 'already_available'
  | 'total_changed'
  | 'checkout_incomplete'
  | 'payment_change_needs_consent'
  | 'order_in_progress'
  | 'cannot_cancel'
  | 'guest_checkout_disabled'
  | 'phone_in_use'
  | 'payment_provider_error'
  // orders extras (v3 error codes, same names)
  | 'already_rated'
  | 'cannot_rate'
  | 'feature_disabled'
  // auth and account (v3 error codes, same names)
  | 'invalid_credentials'
  | 'account_deactivated'
  | 'social_account_only'
  | 'signup_disabled'
  | 'provider_error'
  | 'code_expired'
  | 'too_many_attempts'
  | 'invalid_code'
  | 'sms_unavailable'
  | 'phone_already_verified'
  | 'email_in_use'
  | 'wrong_password'
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, for logging only. Never branch on it. */
  readonly code: number;
  /** Per-field messages, keyed by the names the API used (the v3 field names). */
  readonly fieldErrors: Record<string, string[]>;
  /** What the backend sent next to `error` (e.g. the fresh `checkout` with total_changed). */
  readonly details: Record<string, unknown>;

  constructor(
    kind: ApiErrorKind,
    code: number,
    message: string,
    fieldErrors: Record<string, string[]> = {},
    cause?: unknown,
    details: Record<string, unknown> = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ApiError';
    this.kind = kind;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
