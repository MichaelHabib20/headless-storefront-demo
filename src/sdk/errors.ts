/**
 * Every failure the SDK can report, by name.
 * The legacy API signals errors with numeric `code`s inside HTTP 200 responses;
 * the SDK translates them here so storefront code never sees those numbers.
 */
export type ApiErrorKind =
  | 'validation'
  | 'invalid_credentials'
  | 'account_deactivated'
  | 'social_account_only'
  | 'not_allowed'
  | 'phone_taken'
  | 'signup_disabled'
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
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** Raw legacy code, for logging only. Never branch on it. */
  readonly code: number;
  /** Per-field messages, keyed by the SDK's field names (not the backend's). */
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

/** Returns a copy of the error with backend field names replaced by SDK field names. */
export function renameFields(error: ApiError, names: Record<string, string>): ApiError {
  const fieldErrors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    fieldErrors[names[field] ?? field] = messages;
  }
  return new ApiError(error.kind, error.code, error.message, fieldErrors, error.cause, error.details);
}
