import { NextResponse, type NextRequest } from 'next/server';
import { checkShopper } from '@/lib/session';
import { CUSTOMER_COOKIE, GUEST_COOKIE, SESSION_CHECKED_COOKIE, sessionEndTarget, TOKEN_COOKIE } from '@/lib/session-cookies';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/session/end?to=/en/...`: a page found the customer token dead (the backend refused it:
 * signed out on another device, expired) but can't change cookies while rendering, so it sends the
 * shopper here. The token is checked again (`GET /me`, so a link from elsewhere can't sign anybody
 * out); a dead one loses the customer cookies, and the shopper goes back to `to` as a guest. A token
 * that works, or that can't be checked (backend down: nobody is signed out for that), is kept, and
 * pages don't send the shopper here again for a minute: no redirect loop either way.
 */
export async function GET(request: NextRequest) {
  const { to, locale } = sessionEndTarget(request.nextUrl.searchParams.get('to'));
  const customer = request.cookies.get(TOKEN_COOKIE)?.value ?? null;
  const { session } = customer === null ? { session: 'none' as const } : await checkShopper(locale, customer, request.cookies.get(GUEST_COOKIE)?.value ?? null);

  const response = NextResponse.redirect(new URL(to, request.nextUrl), 303);
  response.headers.set('Cache-Control', 'no-store');
  if (session === 'dead') {
    response.cookies.delete(TOKEN_COOKIE);
    response.cookies.delete(CUSTOMER_COOKIE);
  } else if (session !== 'none') {
    response.cookies.set(SESSION_CHECKED_COOKIE, '1', { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 60 });
  }
  return response;
}
