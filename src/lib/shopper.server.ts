import 'server-only';
import { cookies } from 'next/headers';
import { createGuestSession, type Locale, type ShopperContext } from '@/sdk';
import { GUEST_COOKIE, TOKEN_COOKIE } from './session-cookies';
import { storefrontClient } from './storefront.server';

/**
 * Shopper session. Tokens live only in httpOnly cookies (never readable by browser JS).
 * - `sc_token`: signed-in customer (set by sign-in / sign-up)
 * - `sc_guest`: guest session, created on the FIRST action that needs one (add to cart,
 *   wishlist, compare). Rendering a page never creates a guest.
 */
const GUEST_MAX_AGE = 60 * 60 * 24 * 90;

export async function shopperToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(TOKEN_COOKIE)?.value ?? jar.get(GUEST_COOKIE)?.value ?? null;
}

export async function guestToken(): Promise<string | null> {
  return (await cookies()).get(GUEST_COOKIE)?.value ?? null;
}

/** For reads: the current shopper, or no token (personal endpoints then answer 401). */
export async function shopperContext(locale: Locale): Promise<ShopperContext> {
  return { locale, token: await shopperToken() };
}

/**
 * For writes (server actions / route handlers only): returns a token, creating a guest
 * session first when the visitor has none.
 */
export async function ensureShopperContext(locale: Locale): Promise<ShopperContext> {
  const existing = await shopperToken();
  if (existing) return { locale, token: existing };
  const session = await createGuestSession(storefrontClient(), locale);
  (await cookies()).set(GUEST_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_MAX_AGE,
  });
  return { locale, token: session.token };
}

/** After signing in, the guest's cart/wishlist/compare are merged by the backend; drop the guest cookie. */
export async function forgetGuest(): Promise<void> {
  (await cookies()).delete(GUEST_COOKIE);
}
