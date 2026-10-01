import 'server-only';
import { cookies } from 'next/headers';
import type { Customer, Session } from '@/sdk';
import { forgetGuest } from './shopper.server';

const TOKEN_COOKIE = 'sc_token';
const CUSTOMER_COOKIE = 'sc_customer';

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

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  const customer = jar.get(CUSTOMER_COOKIE)?.value;
  if (!token || !customer) return null;
  try {
    return { token, customer: JSON.parse(customer) as Customer, next: null };
  } catch {
    return null;
  }
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
