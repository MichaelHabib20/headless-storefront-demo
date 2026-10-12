/**
 * Shopping endpoints: product listings, search, categories, brands and the unknown-path resolver
 * (contract: contract/openapi.yaml). Listings and suggestions accept the shopper's token (then
 * prices and limits are the shopper's); categories, brands and resolve are the same for everyone.
 */
import type { StorefrontClient } from './http';
import type { BrandsPage, CategoryTree, Locale, ProductListing, Resolution, SearchSuggestions, VendorsPage } from './types';

interface Ctx {
  locale: Locale;
  token: string | null;
}

/**
 * What a listing page lists. One scope at most; `{}` = all products.
 * - `category`: `CategoryTarget.path` (sent joined with "/")
 * - `list`: `ListTarget.slug`, or its id when the slug is null
 * - `deals`: all deals, or with `category` the deals of that category (the one pair the API allows,
 *   the old storefront's `/product/deals/{cat}`)
 * - `q`: search text
 */
export type ListingScope =
  | { category: readonly string[] }
  | { brand: string }
  | { list: string | number }
  | { tag: string }
  | { deals: true; category?: readonly string[] }
  | { q: string }
  | { vendor: number }
  | Record<string, never>;

/** The page's own query parameters (Next.js `searchParams`, or a URLSearchParams). */
export type ListingParams = URLSearchParams | Record<string, string | string[] | undefined>;

/** The API's scope parameters: they come only from the route, never from the page's own URL. */
const SCOPE_NAMES = ['category', 'brand', 'list', 'tag', 'deals', 'q', 'vendor'];

/** Scope parameters come only from the route; `locale` only from the client. */
const RESERVED = [...SCOPE_NAMES, 'locale'];

const paramEntries = (params: ListingParams): Array<[string, string]> =>
  params instanceof URLSearchParams ? [...params] : Object.entries(params).flatMap(([key, value]) => (Array.isArray(value) ? value.map((v): [string, string] => [key, v]) : value === undefined ? [] : [[key, value]]));

/**
 * True when the page's own URL carries a scope name (`/products/list/x?category=y`): listingQuery
 * drops it, so the backend never sees it and cannot noindex the page for it. The old storefront
 * noindexed every listing URL with a query except `?page=N`, so such a page must not be indexed.
 */
export function hasTypedScope(params: ListingParams = {}): boolean {
  return paramEntries(params).some(([key]) => SCOPE_NAMES.includes(key));
}

/**
 * The request's query: every parameter of the page as it is (filters, sort and pages come from
 * the backend's own `query` strings), plus the scope of the route. Nothing is added, renamed
 * or re-encoded beyond what URLSearchParams does.
 */
export function listingQuery(scope: ListingScope, params: ListingParams = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of paramEntries(params)) if (!RESERVED.includes(key)) query.append(key, value);

  if ('deals' in scope) {
    query.set('deals', 'true');
    if (scope.category?.length) query.set('category', scope.category.join('/'));
  } else if ('category' in scope) query.set('category', scope.category.join('/'));
  else if ('brand' in scope) query.set('brand', scope.brand);
  else if ('list' in scope) query.set('list', String(scope.list));
  else if ('tag' in scope) query.set('tag', scope.tag);
  else if ('q' in scope && scope.q) query.set('q', scope.q);
  else if ('vendor' in scope) query.set('vendor', String(scope.vendor));
  return query.toString();
}

/** phase B: the store's sellers, each with the Target of its products. 404 `not_found` while multi-vendor is off. */
export const getVendors = (client: StorefrontClient, locale: Locale) => client.get<VendorsPage>('vendors', locale);

/** One product listing for every listing page. Unknown scope → ApiError `not_found`; bad filters → `validation`. */
export function getProducts(client: StorefrontClient, ctx: Ctx, scope: ListingScope, params?: ListingParams): Promise<ProductListing> {
  const query = listingQuery(scope, params);
  // The query goes in as one string so repeated parameters and their order survive untouched.
  return client.request<ProductListing>('GET', query ? `products?${query}` : 'products', ctx);
}

/** Products to show under the search box while typing (read-only). */
export const getSearchSuggestions = (client: StorefrontClient, ctx: Ctx, q: string, limit?: number) =>
  client.request<SearchSuggestions>('GET', 'search/suggestions', { ...ctx, query: { q, limit } });

/** The category tree (categories → groups → sub-categories). */
export const getCategories = (client: StorefrontClient, locale: Locale) => client.get<CategoryTree>('categories', locale);

/** One page of the brands index. */
export const getBrands = (client: StorefrontClient, locale: Locale, { page, perPage }: { page?: number; perPage?: number } = {}) =>
  client.request<BrandsPage>('GET', 'brands', { locale, query: { page, perPage } });

/** What a path the storefront has no page for is: `path` is the path and query as requested, with the locale prefix. */
/** `redirectsOnly`: only the merchant's redirect table (for a page the storefront has); `none` when no row applies. */
export const resolvePath = (client: StorefrontClient, locale: Locale, path: string, redirectsOnly = false) =>
  client.request<Resolution>('GET', 'resolve', { locale, query: redirectsOnly ? { path, only: 'redirects' } : { path } });
