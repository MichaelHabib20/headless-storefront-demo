import 'server-only';
import { headers } from 'next/headers';
import type { Locale } from '@/sdk';
import { routes } from './routing';

const HTTP_ORIGIN = /^https?:\/\/[^/\s]+$/i;

/**
 * The public origin of this storefront ("https://shop.example.com"), or null when it can't be known.
 * `SC_SITE_URL` wins when it is set (use it behind proxies that hide the public host); otherwise
 * it is the origin of the request being handled. Server actions and route handlers only.
 */
export async function siteOrigin(): Promise<string | null> {
  const configured = process.env.SC_SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) return HTTP_ORIGIN.test(configured) ? configured : null;

  const request = await headers();
  // A server action is a POST from our own page: the browser says where that page lives.
  const origin = request.get('origin');
  if (origin && HTTP_ORIGIN.test(origin)) return origin;

  const host = first(request.get('x-forwarded-host')) ?? request.get('host');
  if (!host) return null;
  const protocol = first(request.get('x-forwarded-proto')) ?? (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? 'http' : 'https');
  const candidate = `${protocol}://${host}`;
  return HTTP_ORIGIN.test(candidate) ? candidate : null;
}

/**
 * Where the payment page sends the shopper back: this storefront's result page. The backend adds
 * `?checkout=<reference>` to it, and the result page asks the backend what really happened.
 */
export async function checkoutReturnUrl(locale: Locale): Promise<string | null> {
  const origin = await siteOrigin();
  return origin ? `${origin}${routes.checkoutResult(locale)}` : null;
}

function first(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}
