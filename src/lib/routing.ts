import type { Locale, Target } from '@/sdk';

/**
 * The storefront's URL scheme. The ONLY place that turns a backend Target into a URL.
 * Components render links with <TargetLink>, never by inspecting `target.type`.
 */
export const routes = {
  home: (locale: Locale) => `/${locale}`,
  product: (locale: Locale, slug: string) => `/${locale}/p/${encode(slug)}`,
  category: (locale: Locale, path: readonly string[]) => `/${locale}/c/${path.map(encode).join('/')}`,
  brand: (locale: Locale, slug: string) => `/${locale}/brands/${encode(slug)}`,
  list: (locale: Locale, key: string | number) => `/${locale}/lists/${encode(String(key))}`,
  page: (locale: Locale, slug: string) => `/${locale}/pages/${encode(slug)}`,
  landingPage: (locale: Locale, slug: string) => `/${locale}/l/${encode(slug)}`,
  form: (locale: Locale, slug: string) => `/${locale}/forms/${encode(slug)}`,
  deals: (locale: Locale) => `/${locale}/deals`,
  search: (locale: Locale) => `/${locale}/search`,
  cart: (locale: Locale) => `/${locale}/cart`,
  wishlist: (locale: Locale) => `/${locale}/wishlist`,
  account: (locale: Locale) => `/${locale}/account`,
  signIn: (locale: Locale) => `/${locale}/sign-in`,
  signUp: (locale: Locale) => `/${locale}/sign-up`,
  branches: (locale: Locale) => `/${locale}/pages/branches`,
  contact: (locale: Locale) => `/${locale}/pages/contact`,
  trackOrder: (locale: Locale) => `/${locale}/track-order`,
} as const;

export interface ResolvedLink {
  href: string;
  external: boolean;
}

/**
 * Returns null for a null target and for target types this storefront doesn't know
 * yet (the contract only grows; unknown types must be skipped, not guessed).
 */
export function resolveTarget(target: Target | null | undefined, locale: Locale): ResolvedLink | null {
  if (!target) return null;
  switch (target.type) {
    case 'product':
      return internal(routes.product(locale, target.slug));
    case 'category':
      return target.path.length ? internal(routes.category(locale, target.path)) : null;
    case 'brand':
      return internal(routes.brand(locale, target.slug));
    case 'list': {
      const key = target.slug || target.id;
      return key ? internal(routes.list(locale, key)) : null;
    }
    case 'page':
      return internal(routes.page(locale, target.slug));
    case 'landing_page':
      return internal(routes.landingPage(locale, target.slug));
    case 'form':
      return internal(routes.form(locale, target.slug));
    case 'deals':
      return internal(routes.deals(locale));
    case 'home':
      return internal(routes.home(locale));
    case 'url':
      return isSafeUrl(target.url) ? { href: target.url, external: true } : null;
    default:
      return null;
  }
}

/** Same path in the other language: /en/p/x → /ar/p/x */
export function switchLocalePath(pathname: string, to: Locale): string {
  const [, , ...rest] = pathname.split('/');
  return `/${[to, ...rest].filter(Boolean).join('/')}`;
}

function internal(href: string): ResolvedLink {
  return { href, external: false };
}

function encode(segment: string): string {
  return encodeURIComponent(segment);
}

function isSafeUrl(url: string): boolean {
  return /^(https?|mailto|tel):/i.test(url);
}
