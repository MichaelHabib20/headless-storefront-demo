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
  /** Every product (the old storefront's /all-products); the Target `{type: search, query: ""}` opens it. */
  allProducts: (locale: Locale) => `/${locale}/all-products`,
  /** The customer's prescriptions: send one, see and cancel them (the old storefront's /prescriptions). */
  prescriptions: (locale: Locale, page?: number) => withQuery(`/${locale}/prescriptions`, { page: page && page > 1 ? page : null }),
  /** The required address step before a prescription (the old /add-address); saves, then back to prescriptions. */
  addAddress: (locale: Locale) => `/${locale}/add-address`,
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
  // auth and account (profile, password, the pages a `next` step sends the shopper to)
  forgotPassword: (locale: Locale) => `/${locale}/forgot-password`,
  /** The e-mail reset link lands here with `?token=&email=` (the backend appends them); the SMS flow comes without. */
  resetPassword: (locale: Locale) => `/${locale}/reset-password`,
  verifyPhone: (locale: Locale) => `/${locale}/verify-phone`,
  /** The changed-e-mail mail links here with `?email=&token=`. */
  verifyEmail: (locale: Locale) => `/${locale}/verify-email`,
  waitingApproval: (locale: Locale) => `/${locale}/waiting-approval`,
  completeProfile: (locale: Locale) => `/${locale}/account/complete-profile`,
  profile: (locale: Locale) => `/${locale}/account/profile`,
  changePassword: (locale: Locale) => `/${locale}/account/password`,
} as const;

/** The page a `Session.next` / `Me.next` value sends the shopper to, or null when nothing is pending. */
export function nextStepHref(locale: Locale, next: 'verify_phone' | 'waiting_approval' | 'complete_profile' | null | undefined): string | null {
  switch (next) {
    case 'verify_phone':
      return routes.verifyPhone(locale);
    case 'waiting_approval':
      return routes.waitingApproval(locale);
    case 'complete_profile':
      return routes.completeProfile(locale);
    default:
      return null;
  }
}

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
      return internal(target.query ? routes.search(locale, target.query) : routes.allProducts(locale));
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
const OWN_SECTIONS = new Set(['', 'p', 'c', 'brands', 'lists', 'pages', 'l', 'forms', 'tags', 'deals', 'search', 'all-products', 'categories', 'cart', 'wishlist', 'compare', 'notifications', 'checkout', 'account', 'sign-in', 'sign-up', 'track-order', 'forgot-password', 'reset-password', 'verify-phone', 'verify-email', 'waiting-approval', 'prescriptions', 'add-address']);

/** Whether a locale-prefixed path (`/en/c/x`) belongs to one of this storefront's own routes. */
export function isStorefrontPath(pathname: string): boolean {
  const section = pathname.split(/[?#]/)[0].split('/')[2] ?? '';
  return OWN_SECTIONS.has(section);
}

/**
 * Where the address pages send the shopper after a save (`?next=` on the address list, new and edit
 * pages). Only these names are accepted — never a URL — so the parameter can't be an open redirect.
 */
export type AddressReturn = 'checkout' | 'prescriptions';

export function addressReturn(value: string | string[] | null | undefined): AddressReturn | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'checkout' || raw === 'prescriptions' ? raw : null;
}

/** The page an address save goes back to, or null to stay in the address book. */
export function addressReturnHref(locale: Locale, next: AddressReturn | null): string | null {
  if (next === 'checkout') return routes.checkout(locale);
  return next === 'prescriptions' ? routes.prescriptions(locale) : null;
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

/** Where sign-in sends the shopper back: `checkout` (sent by the checkout page) or a safe local path; null otherwise. */
export function signInReturn(locale: Locale, value: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'checkout' ? routes.checkout(locale) : safeReturnPath(raw);
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

// ---- seo + marketing
/** The search page as a schema.org SearchAction URL template (the WebSite JSON-LD on every page). */
export const searchUrlTemplate = (locale: Locale) => `${routes.search(locale)}?q={search_term_string}`;

/** Our own route handler that forwards browser marketing events to the backend (POST /events). Not a page. */
export const EVENTS_ENDPOINT = '/api/events';

/**
 * Sections that are private to the shopper: never indexed (robots.txt, X-Robots-Tag). Includes the
 * auth flows (password reset, verification, approval) and order tracking, whose pages are per shopper.
 */
export const PRIVATE_SECTIONS = [
  'cart',
  'checkout',
  'account',
  'sign-in',
  'sign-up',
  'wishlist',
  'compare',
  'notifications',
  'forgot-password',
  'reset-password',
  'verify-phone',
  'verify-email',
  'waiting-approval',
  'track-order',
  'prescriptions',
  'add-address',
] as const;
