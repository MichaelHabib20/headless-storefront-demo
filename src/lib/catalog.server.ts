import 'server-only';
import type { Metadata } from 'next';
import { cache } from 'react';
import { getBrands, getCategories, getProducts, getVendors, hasTypedScope, isApiError, type BrandsPage, type CategoryTree, type ListingScope, type Locale, type ProductListing, type VendorsPage } from '@/sdk';
import { toApiParams, toSearchParams, type PageParams } from './listing';
import { seoMetadata } from './seo';
import { shopperContext } from './shopper.server';
import { storefrontClient } from './storefront.server';

/** What a listing page could load. */
export type ListingResult =
  | { status: 'ok'; listing: ProductListing }
  | { status: 'not_found' }
  /** The backend refused the page's parameters (e.g. a typed price that is not a number). */
  | { status: 'invalid'; message: string }
  | { status: 'error' };

/**
 * One listing per request (the page and its metadata share it). Read with the shopper's token
 * when there is one (their prices and limits); a token the backend no longer accepts is dropped.
 * Never creates a guest session.
 */
const fetchListing = cache(async (locale: Locale, scopeKey: string, query: string): Promise<ListingResult> => {
  const scope = JSON.parse(scopeKey) as ListingScope;
  const params = new URLSearchParams(query);
  const client = storefrontClient();
  const ctx = await shopperContext(locale);
  try {
    try {
      return { status: 'ok', listing: await getProducts(client, ctx, scope, params) };
    } catch (error) {
      if (!ctx.token || !isApiError(error) || error.kind !== 'unauthenticated') throw error;
      return { status: 'ok', listing: await getProducts(client, { locale, token: null }, scope, params) };
    }
  } catch (error) {
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not_found' };
    if (isApiError(error) && error.kind === 'validation') return { status: 'invalid', message: error.message };
    console.error('listing failed to load', error);
    return { status: 'error' };
  }
});

/**
 * The page's parameters go to the API in its names (the page's links use the old storefront's names).
 * The deals of a category the backend does not know (`/product/deals/{x}`, `/products/deals/{name}`)
 * are all the deals, as on the old storefront, which never answered 404 there; their canonical is
 * then the deals page.
 */
export async function loadListing(locale: Locale, scope: ListingScope, params: PageParams | URLSearchParams): Promise<ListingResult> {
  const query = toApiParams(toSearchParams(params)).toString();
  const result = await fetchListing(locale, JSON.stringify(scope), query);
  if (result.status === 'not_found' && 'deals' in scope && scope.category?.length) return fetchListing(locale, JSON.stringify({ deals: true }), query);
  return result;
}

/**
 * Page meta of a listing, from the backend's `seo` block. A scope name typed into the page's URL
 * (`?category=` on a list page) never reaches the backend (the route gives the scope), so the
 * backend cannot see it: such a URL is noindex here, like every listing URL with a query on the
 * old storefront.
 */
export async function listingMetadata(locale: Locale, scope: ListingScope, params: PageParams): Promise<Metadata> {
  const result = await loadListing(locale, scope, params);
  if (result.status !== 'ok') return { robots: { index: false } };
  const meta = seoMetadata(result.listing.seo, locale);
  return hasTypedScope(params) ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export async function loadCategoryTree(locale: Locale): Promise<CategoryTree | null> {
  try {
    return await getCategories(storefrontClient(), locale);
  } catch (error) {
    console.error('categories failed to load', error);
    return null;
  }
}

/** phase B: the vendors page; `not-found` while the store has multi-vendor off. */
export async function loadVendorsPage(locale: Locale): Promise<{ status: 'ok'; page: VendorsPage } | { status: 'not-found' } | { status: 'error' }> {
  try {
    return { status: 'ok', page: await getVendors(storefrontClient(), locale) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('vendors failed to load', error);
    return { status: 'error' };
  }
}

export async function loadBrandsPage(locale: Locale, page: number, perPage: number): Promise<BrandsPage | null> {
  try {
    return await getBrands(storefrontClient(), locale, { page, perPage });
  } catch (error) {
    console.error('brands failed to load', error);
    return null;
  }
}
