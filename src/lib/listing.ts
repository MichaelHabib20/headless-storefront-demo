/**
 * Links of listing pages. The backend writes every filter, sort and "remove" link as a `query`
 * string; these helpers only put that string after the page's own path. They never read,
 * build or merge filter parameters.
 */

/** A page's own query parameters (Next.js `searchParams`). */
export type PageParams = Record<string, string | string[] | undefined>;

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
 * A listing link: this page's path + the backend's `query`. `keep` are the parameters that make
 * the page what it is (the search text `q` on the search page) — they go first, the backend's
 * query follows untouched.
 */
export function listingHref(path: string, query: string, keep: Record<string, string> = {}): string {
  const own = new URLSearchParams(keep).toString();
  const parts = [own, query.replace(/^\?/, '')].filter(Boolean);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

/** Another page of the same listing: the current query stays as it is, only `page` changes (page 1 has none). */
export function listingPageHref(path: string, current: URLSearchParams | string, page: number): string {
  const params = new URLSearchParams(current);
  if (page > 1) params.set('page', String(page));
  else params.delete('page');
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Hidden fields of a GET form (the price range): the page's own parameters and the parameters of
 * the backend's `query` string, so that submitting sends them back next to the typed numbers.
 */
export function formFields(query: string, keep: Record<string, string> = {}): Array<[string, string]> {
  return [...Object.entries(keep), ...new URLSearchParams(query.replace(/^\?/, ''))];
}

/** A color from the API for a swatch, or null when it is not a plain CSS color (then no swatch is drawn). */
export function swatchColor(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^#[0-9a-f]{3,8}$|^[a-z]{3,30}$|^(rgb|hsl)a?\([\d\s.,%/]+\)$/i.test(value.trim()) ? value.trim() : null;
}
