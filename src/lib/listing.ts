/**
 * Links of listing pages. The backend writes every filter, sort and "remove" link as a `query`
 * string; these helpers put that string after the page's own path. They never decide which
 * filters exist or merge them; they only rename the parameters to the old storefront's names
 * (url-parity-plan §3.2, §7), so filter URLs look like the old site's, and back for the API.
 */

/** A page's own query parameters (Next.js `searchParams`). */
export type PageParams = Record<string, string | string[] | undefined>;

/**
 * v3 API name → the old storefront's name. Multi-value filters are written as one repeated
 * parameter per value (`brand_id=a&brand_id=b`), the way the old Angular router wrote arrays.
 * The values stay what the backend wrote (brand and sub-category slugs, option value ids): the
 * old site put numeric ids there, which the API still reads (`brand_id=758`).
 */
const OLD_NAMES = {
  brands: 'brand_id',
  categories: 'sub_category_id',
  options: 'options_values_ids',
  inStock: 'in_stock',
  priceMin: 'price_from',
  priceMax: 'price_to',
} as const;

/** Filters that hold several values (comma-joined in the API, repeated in the old URLs). */
const MULTI = new Set<string>(['brands', 'categories', 'options']);

/** v3 sort value → the old storefront's sort key. Values without an old key (`featured`, `relevance`) stay as they are. */
const OLD_SORT: Record<string, string> = {
  popular: 'popular',
  name_asc: 'a-z',
  name_desc: 'z-a',
  price_asc: 'low',
  price_desc: 'high',
  rating_asc: 'low-rate',
  rating_desc: 'high-rate',
  discount_desc: 'high-discount',
  newest: 'recent',
};

const V3_SORT: Record<string, string> = Object.fromEntries(Object.entries(OLD_SORT).map(([v3, old]) => [old, v3]));

const truthy = (value: string) => ['1', 'true'].includes(value.trim().toLowerCase());
const values = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean);

/**
 * A query string in the API's names (a backend `query`, or a page's own query) in the old
 * storefront's names: `brands=a,b&inStock=true&priceMin=10&sort=price_asc` →
 * `brand_id=a&brand_id=b&in_stock=1&price_from=10&sort=low`. Anything else (page, search,
 * the old scope parameters, names already old) stays as it is, in its place.
 */
export function toOldQuery(query: URLSearchParams | string): string {
  const out = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(typeof query === 'string' ? query.replace(/^\?/, '') : query)) {
    if (MULTI.has(key)) for (const item of values(value)) out.append(OLD_NAMES[key as keyof typeof OLD_NAMES], item);
    else if (key === 'inStock') {
      if (truthy(value)) out.append(OLD_NAMES.inStock, '1');
    } else if (key === 'priceMin' || key === 'priceMax') out.append(OLD_NAMES[key], value);
    else if (key === 'sort') out.append(key, OLD_SORT[value] ?? value);
    else out.append(key, value);
  }
  return out.toString();
}

/**
 * The page's parameters for `GET /products`: the old names this storefront writes become the
 * API's names again (`brand_id=a&brand_id=b` → `brands=a,b`, `in_stock=1` → `inStock=true`,
 * `price_from` → `priceMin`, `sort=low` → `sort=price_asc`). The v3 names are read too, and win
 * when both are there. Numeric `brand_id` / `sub_category_id` (the old site's ids: bookmarks,
 * menus) go through untouched; the backend turns those ids into slugs and scopes. Other
 * parameters pass as they are, so the backend still sees and validates them.
 */
export function toApiParams(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  const has = (name: string) => params.has(name);
  const add = (name: string, value: string) => {
    const current = out.get(name);
    if (current === null) out.append(name, value);
    else out.set(name, `${current},${value}`);
  };
  for (const [key, value] of params) {
    if (key === OLD_NAMES.brands || key === OLD_NAMES.categories) {
      const v3 = key === OLD_NAMES.brands ? 'brands' : 'categories';
      const slugs = values(value).filter((item) => !/^\d+$/.test(item));
      const ids = values(value).filter((item) => /^\d+$/.test(item));
      if (ids.length) out.append(key, ids.join(','));
      if (!has(v3)) for (const slug of slugs) add(v3, slug);
    } else if (key === OLD_NAMES.options || key === 'attribute_id') {
      if (!has('options') && !(key === 'attribute_id' && has(OLD_NAMES.options))) for (const item of values(value)) add('options', item);
    } else if (key === OLD_NAMES.inStock) {
      if (!has('inStock') && truthy(value) && !out.has('inStock')) out.append('inStock', 'true');
    } else if (key === OLD_NAMES.priceMin || key === OLD_NAMES.priceMax) {
      const v3 = key === OLD_NAMES.priceMin ? 'priceMin' : 'priceMax';
      if (!has(v3) && !out.has(v3)) out.append(v3, value);
    } else if (key === 'sort') out.append(key, V3_SORT[value] ?? value);
    else if (MULTI.has(key)) for (const item of values(value)) add(key, item);
    else out.append(key, value);
  }
  return out;
}

/** The page's query parameters as they came, repeated parameters included. */
export function toSearchParams(params: PageParams | URLSearchParams = {}): URLSearchParams {
  if (params instanceof URLSearchParams) return new URLSearchParams(params);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  return search;
}

/**
 * A listing link: this page's path + the backend's `query` in the old storefront's names.
 * `keep` are the parameters that make the page what it is (the search text on the search
 * page) — they go first, the backend's query follows in its order.
 */
export function listingHref(path: string, query: string, keep: Record<string, string> = {}): string {
  const own = new URLSearchParams(keep).toString();
  const parts = [own, toOldQuery(query)].filter(Boolean);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

/** Another page of the same listing: the current query stays (in the old names), only `page` changes (page 1 has none). */
export function listingPageHref(path: string, current: URLSearchParams | string, page: number): string {
  const params = new URLSearchParams(toOldQuery(current));
  if (page > 1) params.set('page', String(page));
  else params.delete('page');
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Hidden fields of a GET form (the price range): the page's own parameters and the parameters of
 * the backend's `query` string (in the old names), so that submitting sends them back next to
 * the typed numbers (`price_from` / `price_to`, see PRICE_FIELDS).
 */
export function formFields(query: string, keep: Record<string, string> = {}): Array<[string, string]> {
  return [...Object.entries(keep), ...new URLSearchParams(toOldQuery(query))];
}

/** Names of the price range form's two inputs: the old storefront's `price_from` / `price_to`. */
export const PRICE_FIELDS = { min: OLD_NAMES.priceMin, max: OLD_NAMES.priceMax } as const;

/** A color from the API for a swatch, or null when it is not a plain CSS color (then no swatch is drawn). */
export function swatchColor(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^#[0-9a-f]{3,8}$|^[a-z]{3,30}$|^(rgb|hsl)a?\([\d\s.,%/]+\)$/i.test(value.trim()) ? value.trim() : null;
}
