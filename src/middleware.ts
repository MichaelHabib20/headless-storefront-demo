import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['en', 'ar'];

/** Every page lives under /en or /ar. Bare paths get the visitor's preferred language. */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split('/')[1];
  if (LOCALES.includes(first)) return NextResponse.next();

  const preferred = (request.headers.get('accept-language') ?? '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and files with an extension (favicon.ico, robots.txt, images...)
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
