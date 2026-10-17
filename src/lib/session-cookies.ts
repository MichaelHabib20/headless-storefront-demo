/**
 * Names and checks of the shopper's session cookies, shared by the middleware, the server code and
 * the session route handler (no server-only imports: the middleware uses it too).
 *
 * A customer token the backend no longer accepts (signed out on another device, expired, unknown)
 * must never keep the shopper stuck: wherever it is found, the customer cookies are dropped and the
 * shopper goes on as a guest (docs: src/lib/session.ts).
 */
export const TOKEN_COOKIE = 'sc_token';
export const CUSTOMER_COOKIE = 'sc_customer';
export const GUEST_COOKIE = 'sc_guest';

/** Request header the middleware sets: the page's path + query, so server code can come back to it. */
export const PATH_HEADER = 'x-sc-path';

/**
 * Set for a minute when the session route handler was asked to end a session it found still
 * working (or could not check): pages then don't send the shopper there again, so no loop is possible.
 */
export const SESSION_CHECKED_COOKIE = 'sc_session_checked';

/** The route handler that drops a dead customer session, then goes back to `to`. */
export const SESSION_END_PATH = '/api/session/end';

/** A token the backend issued: a JWT (base64url parts and dots). The mock's tokens fit too. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

export function isTokenShape(value: string): boolean {
  return value.length > 0 && value.length <= 4096 && TOKEN_SHAPE.test(value);
}

/**
 * The session cookies that are broken by themselves (no API call needed): a token that can't be one
 * drops both cookies; an unreadable `sc_customer` (display data only) drops just that one.
 */
export function malformedSessionCookies(token: string | undefined, customer: string | undefined): string[] {
  if (token !== undefined && !isTokenShape(token)) return [TOKEN_COOKIE, CUSTOMER_COOKIE];
  if (customer === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(customer);
    return parsed && typeof parsed === 'object' ? [] : [CUSTOMER_COOKIE];
  } catch {
    return [CUSTOMER_COOKIE];
  }
}

/** A path of this storefront to come back to (`/en/...` or `/ar/...`), else null. */
export function safeReturnTarget(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return /^\/(en|ar)(?:[/?#]|$)/.test(raw) ? raw : null;
}

/** The session route handler's `?to=`: where to go back to (the home page when unusable) and its language. */
export function sessionEndTarget(raw: string | null | undefined): { to: string; locale: 'en' | 'ar' } {
  const to = safeReturnTarget(raw);
  const locale = to?.split(/[/?#]/)[1] === 'ar' ? 'ar' : 'en';
  return { to: to ?? `/${locale}`, locale };
}

/** Where a page sends a shopper whose customer token is dead: the route handler, then back to `path`. */
export function sessionEndUrl(path: string | null | undefined, locale: 'en' | 'ar'): string {
  const to = safeReturnTarget(path) ?? `/${locale}`;
  return `${SESSION_END_PATH}?${new URLSearchParams({ to }).toString()}`;
}
