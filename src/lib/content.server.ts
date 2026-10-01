import 'server-only';
import { cache } from 'react';
import { getBranches, getForm, getLandingPage, getPage, isApiError, type BranchesPage, type ContentPage, type LandingPage, type Locale, type MerchantForm } from '@/sdk';
import { storefrontClient } from './storefront.server';

/**
 * Reads of the content pages (CMS pages, branches, landing pages, merchant forms). Public data: no
 * shopper token is sent and none is created.
 *
 * - `ok`: the API answered
 * - `not-found`: 404 (no such page, or switched off by the store, e.g. the contact page)
 * - `error`: anything else
 */
export type ContentResult<T> = { status: 'ok'; data: T } | { status: 'not-found' } | { status: 'error' };

async function read<T>(what: string, call: () => Promise<T>): Promise<ContentResult<T>> {
  try {
    return { status: 'ok', data: await call() };
  } catch (error) {
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error(`${what} failed to load`, error);
    return { status: 'error' };
  }
}

/** Deduplicated per request: the page and its metadata read the same page. */
export const loadPage = cache((locale: Locale, slug: string): Promise<ContentResult<ContentPage>> => read('page', () => getPage(storefrontClient(), locale, slug)));

export const loadBranches = cache((locale: Locale): Promise<ContentResult<BranchesPage>> => read('branches', () => getBranches(storefrontClient(), locale)));

export const loadLandingPage = cache((locale: Locale, slug: string): Promise<ContentResult<LandingPage>> =>
  read('landing page', () => getLandingPage(storefrontClient(), locale, slug)),
);

export const loadForm = cache((locale: Locale, slug: string): Promise<ContentResult<MerchantForm>> => read('form', () => getForm(storefrontClient(), locale, slug)));

/** The slug as the backend wrote it: Next hands dynamic segments over percent-encoded; the SDK encodes it itself. */
export function slugParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
