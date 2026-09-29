import 'server-only';
import { cookies } from 'next/headers';
import type { Customer, Session } from '@/sdk';

const TOKEN_COOKIE = 'sc_token';
const CUSTOMER_COOKIE = 'sc_customer';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

/** The token lives in an httpOnly cookie, so page scripts can never read it. */
export async function saveSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, session.token, cookieOptions);
  jar.set(CUSTOMER_COOKIE, JSON.stringify(session.customer), cookieOptions);
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  const customer = jar.get(CUSTOMER_COOKIE)?.value;
  if (!token || !customer) return null;
  try {
    return { token, customer: JSON.parse(customer) as Customer };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(CUSTOMER_COOKIE);
}
