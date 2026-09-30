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
  /** The address book; `next` carries a return page (see addressReturn), `saved` the id of the address just saved. */
  addresses: (locale: Locale, { next, saved }: { next?: AddressReturn | null; saved?: number | null } = {}) =>
    withQuery(`/${locale}/account/addresses`, { next, saved }),
  newAddress: (locale: Locale, next?: AddressReturn | null) => withQuery(`/${locale}/account/addresses/new`, { next }),
  editAddress: (locale: Locale, id: number, next?: AddressReturn | null) => withQuery(`/${locale}/account/addresses/${id}/edit`, { next }),
  account: (locale: Locale) => `/${locale}/account`,
  /** `returnTo`: a page of this storefront to come back to after signing in (checked with safeReturnPath). */
  signIn: (locale: Locale, returnTo?: string | null) => withQuery(`/${locale}/sign-in`, { next: returnTo }),
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
 * Where the address pages send the shopper after a save (`?next=` on the address list, new and edit
 * pages). Only these names are accepted — never a URL — so the parameter can't be an open redirect.
 */
export type AddressReturn = 'checkout';

export function addressReturn(value: string | string[] | null | undefined): AddressReturn | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'checkout' ? 'checkout' : null;
}

/** The page an address save goes back to, or null to stay in the address book. */
export function addressReturnHref(locale: Locale, next: AddressReturn | null): string | null {
  return next === 'checkout' ? routes.checkout(locale) : null;
}

/**
 * A page of this storefront to go back to (e.g. after signing in), or null. Only local paths under a
 * locale are accepted, so a crafted link can never send the shopper to another site.
 */
export function safeReturnPath(value: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.length > 500 || /[\\\s]/.test(raw) || raw.includes('//')) return null;
  const first = raw.slice(1).split(/[/?#]/)[0];
  return raw.startsWith('/') && Object.hasOwn(LOCALE_SEGMENTS, first) ? raw : null;
}

/** Every locale is a first path segment (type-checked against `Locale`; no SDK import in client bundles). */
const LOCALE_SEGMENTS: Record<Locale, true> = { en: true, ar: true };

/** An external link the API sent as a plain URL (e.g. a branch's `mapUrl`), or null when it isn't a safe web link. */
export function externalHref(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
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

function withQuery(path: string, query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function isSafeUrl(url: string): boolean {
  return /^(https?|mailto|tel):/i.test(url);
}
