import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createStorefrontClient, getHome, getLayout, type Locale, type StorefrontClient } from '@/sdk';
import { CUSTOMER_COOKIE, TOKEN_COOKIE } from './session-cookies';

/** Server-side v3 client from environment variables. The api-key never reaches the browser. */
export function storefrontClient(): StorefrontClient {
  const baseUrl = process.env.SC_API_URL;
  if (!baseUrl) throw new Error('SC_API_URL is not set. Copy .env.example to .env.local and fill it in.');
  return createStorefrontClient({
    baseUrl,
    apiKey: process.env.SC_API_KEY || undefined,
    revalidate: Number(process.env.SC_REVALIDATE_SECONDS ?? 60),
    onTokenRefused: forgetRefusedToken,
  });
}

/**
 * The backend refused `token` (401 `unauthenticated`). When it is the customer cookie's token, the
 * customer session is over (signed out on another device, expired): server actions and route
 * handlers drop the customer cookies here, so the shopper goes on as a guest. While a page renders,
 * cookies are read-only: the layout sends the shopper through the session route handler instead
 * (src/lib/session.ts readShopper, src/app/api/session/end/route.ts).
 */
export async function forgetRefusedToken(token: string): Promise<void> {
  let jar;
  try {
    jar = await cookies();
  } catch {
    return; // outside a request: nothing to drop
  }
  if (jar.get(TOKEN_COOKIE)?.value !== token) return;
  try {
    jar.delete(TOKEN_COOKIE);
    jar.delete(CUSTOMER_COOKIE);
  } catch {
    // rendering a page: read-only cookies
  }
}

/** Deduplicated per request: the layout is read by both the layout and page components. */
export const loadLayout = cache((locale: Locale) => getLayout(storefrontClient(), locale));
export const loadHome = cache((locale: Locale) => getHome(storefrontClient(), locale));
