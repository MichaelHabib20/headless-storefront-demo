import type { Locale, Target } from '@/sdk';

/** Legal pages: the old storefront served them at the root, not under /pages (PageTarget.legal). */
export const LEGAL_PATHS = { privacy: 'privacy-policy', terms: 'terms-and-conditions', cookies: 'cookie-policy' } as const;
export type LegalKind = keyof typeof LEGAL_PATHS;

/** The CMS slug of a legal page (`Layout.legal[kind]`), or the fixed slug of its root path without one. */
export function legalPageSlug(target: Target | null | undefined, kind: LegalKind): string {
  return target?.type === 'page' ? target.slug : LEGAL_PATHS[kind];
}

/**
 * The storefront's URL scheme: the OLD storefront's URLs, unchanged (docs/headless/url-parity-plan.md
 * in the backend repo), so indexed pages, shared links and the links in e-mails keep working.
 * The ONLY place that turns a backend Target into a URL.
 * Components render links with <TargetLink>, never by inspecting `target.type`.
 */
export const routes = {
  home: (locale: Locale) => `/${locale}`,
  /** A product is a single segment at the root: /en/{slug} (Arabic slug on /ar). */
  product: (locale: Locale, slug: string) => `/${locale}/${encode(slug)}`,
  /** Category, group or sub-category: /product/{cat}[/{group}][/{sub}] (Arabic slugs on /ar, from the API). */
  category: (locale: Locale, path: readonly string[]) => `/${locale}/product/${path.map(encode).join('/')}`,
  /** Brand listing; several brands are joined with `--` (the old a--b listing). */
  brand: (locale: Locale, slug: string) => `/${locale}/product/brand/${slug.split('--').map(encode).join('--')}`,
  list: (locale: Locale, key: string | number) => `/${locale}/products/list/${encode(String(key))}`,
  /** A CMS page under /pages; a legal page at the root (/privacy-policy, /terms-and-conditions, /cookie-policy). */
  page: (locale: Locale, slug: string, legal?: LegalKind | null) => (legal && LEGAL_PATHS[legal] ? `/${locale}/${LEGAL_PATHS[legal]}` : `/${locale}/pages/${encode(slug)}`),
  landingPage: (locale: Locale, slug: string) => `/${locale}/landing-page/${encode(slug)}`,
  form: (locale: Locale, slug: string) => `/${locale}/forms/${encode(slug)}`,
  tag: (locale: Locale, slug: string) => `/${locale}/products/tag/${encode(slug)}`,
  /** The old /products/deals/{name}: the deals of the category `name` (only its own page links here). */
  dealsByName: (locale: Locale, name: string) => `/${locale}/products/deals/${encode(name)}`,
  /** All deals; with a category path the deals of that category: /product/deals/{cat} (the old category chips, Arabic slug on /ar). */
  deals: (locale: Locale, category: readonly string[] = []) => (category.length ? `/${locale}/product/deals/${category.map(encode).join('/')}` : `/${locale}/products/deals`),
  /** Search results (`?search=`, the old storefront's name); without a query it lists all products. */
  search: (locale: Locale, query = '') => (query ? `/${locale}/products?search=${encode(query)}` : `/${locale}/products`),
  /** Every product (the old storefront's /all-products); the Target `{type: search, query: ""}` opens it. */
  allProducts: (locale: Locale) => `/${locale}/all-products`,
  /** The customer's prescriptions: send one, see and cancel them (the old storefront's /prescriptions). */
  prescriptions: (locale: Locale, page?: number) => withQuery(`/${locale}/prescriptions`, { page: page && page > 1 ? page : null }),
  /** The required address step before a prescription (the old /add-address); saves, then back to prescriptions. */
  addAddress: (locale: Locale) => `/${locale}/add-address`,
  categories: (locale: Locale) => `/${locale}/categories`,
  /** The old storefront's categories index (the same page as /categories, at its own address). */
  allCategories: (locale: Locale) => `/${locale}/all-categories`,
  /**
   * The old storefront's category view (stores with ENABLE_CATEGORY_VIEW indexed it): a category's
   * groups, or a group's sub-categories, at /category/{cat}[/{group}]; no path = every category.
   * Only its own page links here (canonical, hreflang): Targets open the listing at /product/....
   */
  categoryView: (locale: Locale, path: readonly string[] = []) => `/${locale}/category${path.map((segment) => `/${encode(segment)}`).join('')}`,
  /** The old /category-view: every category (the same page as /category). */
  categoryViewIndex: (locale: Locale) => `/${locale}/category-view`,
  brands: (locale: Locale) => `/${locale}/brands`,
  cart: (locale: Locale) => `/${locale}/cart`,
  wishlist: (locale: Locale) => `/${locale}/favorites`,
  compare: (locale: Locale) => `/${locale}/compare`,
  notifications: (locale: Locale) => `/${locale}/notifications`,
  checkout: (locale: Locale) => `/${locale}/checkout`,
  /**
   * Where the shopper lands after placing an order or paying (the old /checkout/final-receipt);
   * `reference` comes from the API. Old gateways land here with `?order_id=&is_success=` instead.
   */
  checkoutResult: (locale: Locale, reference?: string) =>
    reference ? `/${locale}/checkout/final-receipt?checkout=${encode(reference)}` : `/${locale}/checkout/final-receipt`,
  orders: (locale: Locale) => `/${locale}/account/order-history`,
  /** By uuid (or number, for old orders): the order e-mails link here. */
  order: (locale: Locale, id: string) => `/${locale}/account/order-history/${encode(id)}`,
  /** The address book; `next` carries a return page (see addressReturn), `saved` the id of the address just saved. */
  addresses: (locale: Locale, { next, saved }: { next?: AddressReturn | null; saved?: number | null } = {}) =>
    withQuery(`/${locale}/account/address`, { next, saved }),
  newAddress: (locale: Locale, next?: AddressReturn | null) => withQuery(`/${locale}/account/address/add`, { next }),
  editAddress: (locale: Locale, id: number, next?: AddressReturn | null) => withQuery(`/${locale}/account/address/edit/${id}`, { next }),
  account: (locale: Locale) => `/${locale}/account`,
  /** `returnTo`: a page of this storefront to come back to after signing in (checked with safeReturnPath). */
  signIn: (locale: Locale, returnTo?: string | null) => withQuery(`/${locale}/session/signin`, { returnUrl: returnTo }),
  signUp: (locale: Locale) => `/${locale}/session/signup`,
  branches: (locale: Locale) => `/${locale}/pages/branches`,
  contact: (locale: Locale) => `/${locale}/pages/contact`,
  trackOrder: (locale: Locale) => `/${locale}/account/track-your-order`,
  // auth and account (profile, password, the pages a `next` step sends the shopper to)
  forgotPassword: (locale: Locale) => `/${locale}/session/forgot-password`,
  /**
   * The e-mail reset link lands here with `?token=` (the old mail: `?changePassword=true&token=`, the
   * v3 mail adds `&email=`); the SMS flow comes with `?phone=`.
   */
  resetPassword: (locale: Locale) => `/${locale}/session/change-password`,
  verifyPhone: (locale: Locale) => `/${locale}/verify-phone`,
  /** The changed-e-mail mail links here with `?email=&token=` (the old storefront's mixed-case path). */
  verifyEmail: (locale: Locale) => `/${locale}/session/verifyEmail`,
  waitingApproval: (locale: Locale) => `/${locale}/session/waiting-approval`,
  completeProfile: (locale: Locale) => `/${locale}/account/complete-profile`,
  profile: (locale: Locale) => `/${locale}/account/profile`,
  changePassword: (locale: Locale) => `/${locale}/account/change-password`,
  // loyalty (the old storefront's paths): points, rewards ("vouchers"), one reward, history, referral
  points: (locale: Locale) => `/${locale}/account/your-points`,
  rewards: (locale: Locale) => `/${locale}/account/vouchers`,
  /** One reward; old links with a name segment (`/account/vouchers/:id/:name`) open the same page. */
  reward: (locale: Locale, id: string) => `/${locale}/account/vouchers/${encode(id)}`,
  pointsHistory: (locale: Locale, page?: number) => withQuery(`/${locale}/account/history`, { page: page && page > 1 ? page : null }),
  freePoints: (locale: Locale) => `/${locale}/account/get-free-points`,
  /** phase B: where refunds are sent (the old storefront's /account/bank-information). */
  bankDetails: (locale: Locale) => `/${locale}/account/bank-information`,
  /** phase B: the customer's insurance profiles (the old storefront's /account/insurance, a dead page there). */
  insurance: (locale: Locale) => `/${locale}/account/insurance`,
  /** phase B: the store's sellers (the old storefront's /vendors) and one seller's products (it used products?vendor_ids=). */
  vendors: (locale: Locale) => `/${locale}/vendors`,
  vendor: (locale: Locale, id: number) => `/${locale}/vendors/${id}`,
  /** phase B: the customer's vouchers and cashback vouchers (the old storefront's /account/voucher; not the loyalty rewards at /account/vouchers). */
  myVouchers: (locale: Locale) => `/${locale}/account/voucher`,
  /** phase B: the wallet balance and its history (the old storefront's /account/wallet-history). */
  wallet: (locale: Locale, page?: number) => withQuery(`/${locale}/account/wallet-history`, { page: page && page > 1 ? page : null }),
} as const;

/** The page that clears a prescription blocker (`PrescriptionForm.blockers[].code`); null for a code this storefront does not know. */
export function prescriptionStepHref(locale: Locale, code: string): string | null {
  switch (code) {
    case 'add_address':
      return routes.addAddress(locale);
    case 'verify_phone':
      return routes.verifyPhone(locale);
    case 'add_phone':
      return routes.profile(locale);
    default:
      return null;
  }
}

/** The page that clears a loyalty blocker (`LoyaltyBlocker.code`); null for a code this storefront does not know. */
export function loyaltyStepHref(locale: Locale, code: string): string | null {
  return code === 'add_phone' || code === 'verify_phone' ? prescriptionStepHref(locale, code) : null;
}

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
      return internal(routes.page(locale, target.slug, target.legal));
    case 'landing_page':
      return internal(routes.landingPage(locale, target.slug));
    case 'form':
      return internal(routes.form(locale, target.slug));
    case 'tag':
      return internal(routes.tag(locale, target.slug));
    case 'search':
      return internal(target.query ? routes.search(locale, target.query) : routes.allProducts(locale));
    case 'deals':
      return internal(routes.deals(locale, target.category ?? []));
    case 'home':
      return internal(routes.home(locale));
    case 'url':
      return isSafeUrl(target.url) ? { href: target.url, external: true } : null;
    case 'vendor':
      return target.id > 0 ? internal(routes.vendor(locale, target.id)) : null;
    default:
      return null;
  }
}

/**
 * A category Target at the old storefront's category view (/category/{cat}[/{group}]) instead of its
 * listing: for sitemap entries the backend marks `categoryView` (stores with ENABLE_CATEGORY_VIEW /
 * ENABLE_SUBCATEGORY_VIEW listed them there). Null for any other Target.
 */
export function resolveCategoryView(target: Target | null | undefined, locale: Locale): ResolvedLink | null {
  return target?.type === 'category' && target.path.length ? internal(routes.categoryView(locale, target.path)) : null;
}

/**
 * First path segments that are never a product slug: this storefront's own sections, the old
 * storefront's other pages (the backend resolves them: /brand/{id}, /blog) and the
 * interim paths of INTERIM_REDIRECTS. A single segment outside this list is a product (/en/{slug}).
 */
export const RESERVED_SEGMENTS = new Set([
  // own sections
  'product', 'products', 'pages', 'forms', 'landing-page', 'brand-page', 'all-products', 'categories', 'all-categories', 'brands', 'vendors',
  'category', 'category-view', 'privacy-policy', 'terms-and-conditions', 'cookie-policy',
  'cart', 'checkout', 'favorites', 'compare', 'notifications', 'prescriptions', 'add-address', 'verify-phone', 'session', 'account', 'orders',
  // old storefront pages the backend resolves
  'brand', 'blog', 'under-construction', 'not-found',
  // interim paths (INTERIM_REDIRECTS)
  'p', 'c', 'l', 'lists', 'tags', 'deals', 'search', 'wishlist', 'sign-in', 'sign-up', 'forgot-password', 'reset-password', 'verify-email', 'waiting-approval', 'track-order',
]);

/**
 * The shapes of this storefront's own pages, after the locale. A path outside them (an old URL the
 * storefront doesn't render, a row of the merchant's redirect table) is asked about in the
 * middleware, before rendering. routing.test.ts fails when a route above is missing here.
 */
const OWN_PATHS: RegExp[] = [
  /^$/,
  /^[^/]+$/, // a product (reserved first segments are checked first)
  /^product(\/[^/]+){0,4}$/,
  /^products(\/deals(\/[^/]+)?|\/list\/[^/]+(\/[^/]+)?|\/tag\/[^/]+)?$/,
  /^(pages|forms|landing-page|brand-page)\/[^/]+$/,
  /^(all-products|categories|all-categories|brands|vendors|category|category-view|privacy-policy|terms-and-conditions|cookie-policy)$/,
  /^vendors\/[^/]+$/,
  /^category(\/[^/]+){1,2}$/,
];

/** The shopper's own pages (no SEO, no merchant redirects): every path under these is ours. */
const PRIVATE_PATHS = /^(cart|checkout|favorites|compare|notifications|prescriptions|add-address|verify-phone|session|account|orders)(\/.*)?$/;

/** Single-segment pages of our own; any other reserved segment alone is not a product. */
const OWN_SINGLE = new Set(['product', 'products', 'all-products', 'categories', 'all-categories', 'brands', 'vendors', 'category', 'category-view', 'privacy-policy', 'terms-and-conditions', 'cookie-policy']);

/** The path after the locale (`product/x`), '' for the home page; null without a locale. */
function rest(pathname: string): string | null {
  const parts = pathname.split(/[?#]/)[0].split('/');
  if (!Object.hasOwn(LOCALE_SEGMENTS, parts[1] ?? '')) return null;
  return parts.slice(2).join('/').replace(/\/+$/, '');
}

/** Whether a locale-prefixed path (`/en/product/x`) is one of this storefront's own pages. */
export function isStorefrontPath(pathname: string): boolean {
  const path = rest(pathname);
  if (path === null) return false;
  if (PRIVATE_PATHS.test(path)) return true;
  if (!path.includes('/') && RESERVED_SEGMENTS.has(path) && !OWN_SINGLE.has(path)) return false;
  return OWN_PATHS.some((shape) => shape.test(path));
}

/** Whether a locale-prefixed path is one of the shopper's own pages (cart, account, session...). */
export function isPrivatePath(pathname: string): boolean {
  const path = rest(pathname);
  return path !== null && PRIVATE_PATHS.test(path);
}

/**
 * The interim URLs this storefront used before it took over the old storefront's URLs (staging,
 * AI Designer previews, test e-mails): a permanent redirect to the old URL. One release, then remove.
 * Returns the new path + query, or null.
 */
export function interimRedirect(pathname: string, search: string): string | null {
  const parts = pathname.split('/');
  const locale = parts[1];
  if (!Object.hasOwn(LOCALE_SEGMENTS, locale ?? '')) return null;
  const path = parts.slice(2).join('/').replace(/\/$/, '');
  const query = new URLSearchParams(search);
  const withSearch = (target: string, q: URLSearchParams = query) => (q.size ? `${target}?${q}` : target);
  const rename = (from: string, to: string) => {
    if (query.has(from)) {
      query.set(to, query.get(from) ?? '');
      query.delete(from);
    }
  };
  const map: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/^p\/([^/]+)$/, (m) => m[1]],
    [/^c\/(.+)$/, (m) => `product/${m[1]}`],
    [/^lists\/([^/]+)$/, (m) => `products/list/${m[1]}`],
    [/^tags\/([^/]+)$/, (m) => `products/tag/${m[1]}`],
    [/^l\/([^/]+)$/, (m) => `landing-page/${m[1]}`],
    [/^deals$/, () => 'products/deals'],
    [/^search$/, () => {
      rename('q', 'search');
      return 'products';
    }],
    [/^wishlist$/, () => 'favorites'],
    [/^sign-in$/, () => {
      rename('next', 'returnUrl');
      return 'session/signin';
    }],
    [/^sign-up$/, () => 'session/signup'],
    [/^forgot-password$/, () => 'session/forgot-password'],
    [/^reset-password$/, () => 'session/change-password'],
    [/^verify-email$/, () => 'session/verifyEmail'],
    [/^waiting-approval$/, () => 'session/waiting-approval'],
    [/^track-order$/, () => 'account/track-your-order'],
    [/^checkout\/result$/, () => 'checkout/final-receipt'],
    [/^account\/orders(\/[^/]+)?$/, (m) => `account/order-history${m[1] ?? ''}`],
    [/^account\/addresses$/, () => 'account/address'],
    [/^account\/addresses\/new$/, () => 'account/address/add'],
    [/^account\/addresses\/([^/]+)\/edit$/, (m) => `account/address/edit/${m[1]}`],
    [/^account\/password$/, () => 'account/change-password'],
  ];
  for (const [shape, to] of map) {
    const m = path.match(shape);
    if (m) return withSearch(`/${locale}/${to(m)}`);
  }
  return null;
}

/**
 * Old account pages this storefront doesn't have (saved cards, the affiliate programme): the account
 * home instead of a 404. Returns the account path, or null.
 */
export function retiredAccountPage(pathname: string): string | null {
  const m = pathname.match(/^\/(en|ar)\/(account|orders)\/(cards|affiliate-wallet-history|link-builder)\/?$/);
  return m ? routes.account(m[1] as Locale) : null;
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

/** Same path in the other language: /en/x → /ar/x (a product page then moves to its Arabic slug). */
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
export const searchUrlTemplate = (locale: Locale) => `${routes.search(locale)}?search={search_term_string}`;

/** Our own route handler that forwards browser marketing events to the backend (POST /events). Not a page. */
export const EVENTS_ENDPOINT = '/api/events';

/**
 * Sections that are private to the shopper: never indexed (robots.txt, X-Robots-Tag). The old
 * storefront's list: `session` holds the auth flows, `account` / `orders` the account pages and
 * order tracking.
 */
export const PRIVATE_SECTIONS = [
  'cart',
  'checkout',
  'account',
  'orders',
  'session',
  'favorites',
  'compare',
  'notifications',
  'verify-phone',
  'prescriptions',
  'add-address',
] as const;
