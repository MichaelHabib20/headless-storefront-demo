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
  tag: (locale: Locale, slug: string) => `/${locale}/tags/${encode(slug)}`,
  deals: (locale: Locale) => `/${locale}/deals`,
  /** Search results; without a query it lists all products. */
  search: (locale: Locale, query = '') => (query ? `/${locale}/search?q=${encode(query)}` : `/${locale}/search`),
  categories: (locale: Locale) => `/${locale}/categories`,
  brands: (locale: Locale) => `/${locale}/brands`,
  cart: (locale: Locale) => `/${locale}/cart`,
  wishlist: (locale: Locale) => `/${locale}/wishlist`,
  compare: (locale: Locale) => `/${locale}/compare`,
  notifications: (locale: Locale) => `/${locale}/notifications`,
  checkout: (locale: Locale) => `/${locale}/checkout`,
  /** Where the shopper lands after placing an order or paying; `reference` comes from the API. */
  checkoutResult: (locale: Locale, reference?: string) =>
    reference ? `/${locale}/checkout/result?checkout=${encode(reference)}` : `/${locale}/checkout/result`,
  orders: (locale: Locale) => `/${locale}/account/orders`,
  order: (locale: Locale, id: string) => `/${locale}/account/orders/${encode(id)}`,
  addresses: (locale: Locale) => `/${locale}/account/addresses`,
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
    case 'tag':
      return internal(routes.tag(locale, target.slug));
    case 'search':
      return internal(routes.search(locale, target.query));
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

/**
 * The first path segment (after the locale) of every route above; '' is the home page.
 * A path outside these is not one of this storefront's pages: the middleware asks the backend
 * what it is (old storefront URLs, the merchant's redirects). routing.test.ts fails when a
 * route above is missing here.
 */
const OWN_SECTIONS = new Set(['', 'p', 'c', 'brands', 'lists', 'pages', 'l', 'forms', 'tags', 'deals', 'search', 'categories', 'cart', 'wishlist', 'compare', 'notifications', 'checkout', 'account', 'sign-in', 'sign-up', 'track-order']);

/** Whether a locale-prefixed path (`/en/c/x`) belongs to one of this storefront's own routes. */
export function isStorefrontPath(pathname: string): boolean {
  const section = pathname.split(/[?#]/)[0].split('/')[2] ?? '';
  return OWN_SECTIONS.has(section);
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
