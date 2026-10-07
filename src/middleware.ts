import { NextResponse, type NextRequest } from 'next/server';
import type { Locale } from '@/sdk';
import { RESOLUTION_HEADER } from '@/lib/resolve';
import { answerPath } from '@/lib/resolve.server';
import { interimRedirect, isPrivatePath, isStorefrontPath, PRIVATE_SECTIONS, retiredAccountPage } from '@/lib/routing';
import { CLICK_IDS_COOKIE, CLICK_IDS_MAX_AGE, clickIdsCookie } from '@/lib/click-ids';

const LOCALES = ['en', 'ar'];

/**
 * The old storefront's URLs, answered the way its server did (docs/headless/url-parity-plan.md):
 * 1. Every page lives under /en or /ar: a bare path gets a 301 to /en + the path.
 * 2. The interim URLs of this storefront (/p/x, /c/..., /sign-in...) get a 301 to the old URL.
 * 3. `/orders/...` is the old alias of `/account/...` (the guest order link): shown at the same URL.
 * 4. A page of ours that is not private: the merchant's redirect table may move it (301/302) or mark
 *    it gone (410) — checked on every request, answers reused for a minute.
 * 5. A path that is none of our pages (an old URL we don't render, a redirect-table row) is resolved
 *    by the backend before rendering: 301/302, 410 (the catch-all page draws it) or 404.
 */
export async function middleware(request: NextRequest) {
  return marketingAndRobots(request, await route(request));
}

/**
 * 6. Campaign click ids of the landing URL (fbclid, gclid, ttclid, sccid) are kept in an httpOnly
 *    cookie for 7 days, for the server-side marketing events (src/lib/click-ids.ts).
 * 7. The shopper's private pages (cart, checkout, account...) answer `X-Robots-Tag: noindex`.
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
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname === '/' ? '' : pathname}`;
    url.search = search;
    return NextResponse.redirect(url, 301);
  }

  const interim = interimRedirect(pathname, search);
  if (interim) return NextResponse.redirect(new URL(interim, request.nextUrl), 301);
  const retired = retiredAccountPage(pathname);
  if (retired) return NextResponse.redirect(new URL(retired, request.nextUrl), 302);

  const headers = new Headers(request.headers);
  headers.delete(RESOLUTION_HEADER);

  if (isPrivatePath(pathname)) {
    const alias = pathname.match(/^\/(en|ar)\/orders(\/.*)?$/);
    if (alias) {
      const url = request.nextUrl.clone();
      url.pathname = `/${alias[1]}/account${alias[2] ?? ''}`;
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  }

  if (isStorefrontPath(pathname)) {
    const answer = await answerPath(first as Locale, request.nextUrl, true);
    if (answer?.kind === 'redirect') return NextResponse.redirect(new URL(answer.location, request.nextUrl), answer.status);
    if (answer?.kind === 'gone') {
      headers.set(RESOLUTION_HEADER, 'gone');
      return NextResponse.rewrite(goneUrl(request), { status: 410, request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  }

  const answer = await answerPath(first as Locale, request.nextUrl);
  if (answer?.kind === 'redirect') return NextResponse.redirect(new URL(answer.location, request.nextUrl), answer.status);
  if (answer?.kind === 'gone') {
    headers.set(RESOLUTION_HEADER, 'gone');
    return NextResponse.next({ status: 410, request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

/**
 * A page of ours the redirect table marks gone: drawn by the catch-all's "no longer available" page
 * at the same URL (a path with a reserved first segment that no page matches).
 */
function goneUrl(request: NextRequest): URL {
  const url = request.nextUrl.clone();
  url.pathname = `/${request.nextUrl.pathname.split('/')[1]}/not-found/gone`;
  return url;
}

export const config = {
  // Node.js runtime: resolving paths calls the backend through the SDK.
  runtime: 'nodejs',
  // Skip Next internals and files with an extension (favicon.ico, robots.txt, sitemaps, images...);
  // under a locale every path is checked (old storefront URLs may have one: /en/product/x.html).
  matcher: ['/((?!_next/|api/|.*\\..*).*)', '/(en|ar)/:path*'],
};
