import { NextResponse, type NextRequest } from 'next/server';
import type { Locale } from '@/sdk';
import { RESOLUTION_HEADER } from '@/lib/resolve';
import { answerUnknownPath } from '@/lib/resolve.server';
import { isStorefrontPath, PRIVATE_SECTIONS } from '@/lib/routing';
import { CLICK_IDS_COOKIE, CLICK_IDS_MAX_AGE, clickIdsCookie } from '@/lib/click-ids';

const LOCALES = ['en', 'ar'];

/**
 * 1. Every page lives under /en or /ar. Bare paths get the visitor's preferred language.
 * 2. A path that is none of the storefront's own routes (an old storefront URL, a row of the
 *    merchant's redirect table) is resolved by the backend here, before rendering, so the answer
 *    has the right status: 301/302 redirect, 410 gone (the catch-all page draws it) or 404.
 */
export async function middleware(request: NextRequest) {
  return marketingAndRobots(request, await route(request));
}

/**
 * 3. Campaign click ids of the landing URL (fbclid, gclid, ttclid, sccid) are kept in an httpOnly
 *    cookie for 7 days, for the server-side marketing events (src/lib/click-ids.ts).
 * 4. The shopper's private pages (cart, checkout, account...) answer `X-Robots-Tag: noindex`.
 */
function marketingAndRobots(request: NextRequest, response: NextResponse): NextResponse {
  const clickIds = clickIdsCookie(request.nextUrl.searchParams, request.cookies.get(CLICK_IDS_COOKIE)?.value);
  if (clickIds) {
    response.cookies.set(CLICK_IDS_COOKIE, clickIds, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: CLICK_IDS_MAX_AGE });
  }
  const section = request.nextUrl.pathname.split('/')[2] ?? '';
  if ((PRIVATE_SECTIONS as readonly string[]).includes(section)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

async function route(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split('/')[1];
  if (!LOCALES.includes(first)) {
    const preferred = (request.headers.get('accept-language') ?? '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }
  if (isStorefrontPath(pathname)) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.delete(RESOLUTION_HEADER);
  const answer = await answerUnknownPath(first as Locale, request.nextUrl);
  if (answer?.kind === 'redirect') return NextResponse.redirect(new URL(answer.location, request.nextUrl), answer.status);
  if (answer?.kind === 'gone') {
    headers.set(RESOLUTION_HEADER, 'gone');
    return NextResponse.next({ status: 410, request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Node.js runtime: resolving unknown paths calls the backend through the SDK.
  runtime: 'nodejs',
  // Skip Next internals and files with an extension (favicon.ico, robots.txt, images...);
  // under a locale every path is checked (old storefront URLs may have one: /en/product/x.html).
  matcher: ['/((?!_next|api|.*\\..*).*)', '/(en|ar)/:path*'],
};
