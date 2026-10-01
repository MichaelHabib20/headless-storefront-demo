import 'server-only';
import { cache } from 'react';
import { getSiteSeo, getSitemap, type Locale, type SiteSeo, type SitemapPage, type SitemapType } from '@/sdk';
import { storefrontClient } from './storefront.server';

/** Site-wide SEO facts (JSON-LD, Google verification, robots policy), once per request; null when the API fails. */
export const loadSiteSeo = cache(async (locale: Locale): Promise<SiteSeo | null> => {
  try {
    return await getSiteSeo(storefrontClient(), locale);
  } catch (error) {
    console.error('site seo failed to load', error);
    return null;
  }
});

/** One page of sitemap entries; null when the API fails (the sitemap then lists nothing for it). */
export async function loadSitemapPage(locale: Locale, type: SitemapType, page: number, perPage: number): Promise<SitemapPage | null> {
  try {
    return await getSitemap(storefrontClient(), locale, type, { page, perPage });
  } catch (error) {
    console.error('sitemap failed to load', error);
    return null;
  }
}
