import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getMe, isApiError, type Locale, type Me, type Session } from '@/sdk';
import { CUSTOMER_COOKIE, GUEST_COOKIE, isTokenShape, TOKEN_COOKIE } from './session-cookies';
import { forgetGuest } from './shopper.server';
import { storefrontClient } from './storefront.server';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

/** The token lives in an httpOnly cookie, so page scripts can never read it. `sc_customer` is the v3 `Customer`. */
export async function saveSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, session.token, cookieOptions);
  jar.set(CUSTOMER_COOKIE, JSON.stringify(session.customer), cookieOptions);
}

/**
 * After a successful sign-in / sign-up / reset / OTP / social answer: keep the session and drop
 * the guest cookie (the backend merged the guest into the customer).
 */
export async function startSession(session: Session): Promise<void> {
  await saveSession(session);
  await forgetGuest();
}

/** The customer's token only (never the guest's), for the endpoints that need a customer. */
export async function customerToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(CUSTOMER_COOKIE);
}

/**
 * The customer session as the backend sees it:
 * - `none`: no customer cookie (a guest or a new visitor)
 * - `live`: the backend knows the customer
 * - `dead`: the backend refused the token (401) or answered "not signed in" (an expired or unknown
 *   token reads as anonymous on `GET /me`): the cookie must go
 * - `unknown`: the backend could not be asked (5xx, network): nothing is decided, nobody is signed out
 */
export type CustomerSession = 'none' | 'live' | 'dead' | 'unknown';

export interface ShopperRead {
  /** `GET /me` (null when it failed or the customer token is dead). */
  me: Me | null;
  session: CustomerSession;
}

/** `GET /me` with `token` and what it says about the customer token. */
export async function checkShopper(locale: Locale, customer: string | null, guest: string | null): Promise<ShopperRead> {
  if (customer !== null && !isTokenShape(customer)) return { me: null, session: 'dead' };
  try {
    const me = await getMe(storefrontClient(), { locale, token: customer ?? guest });
    if (customer === null) return { me, session: 'none' };
    return me.authenticated && !me.isGuest ? { me, session: 'live' } : { me: null, session: 'dead' };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { me: null, session: customer === null ? 'none' : 'dead' };
    console.error('me failed to load', error);
    return { me: null, session: customer === null ? 'none' : 'unknown' };
  }
}

/** Who is shopping, read once per request (the layout and the sign-in / sign-up pages share it). Never creates a guest. */
export const readShopper = cache(async (locale: Locale): Promise<ShopperRead> => {
  const jar = await cookies();
  return checkShopper(locale, jar.get(TOKEN_COOKIE)?.value ?? null, jar.get(GUEST_COOKIE)?.value ?? null);
});
