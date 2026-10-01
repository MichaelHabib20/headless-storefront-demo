/**
 * SEO answers used by tests, generated from the contract-checked mock (`node scripts/build-seo-fixtures.mjs`;
 * `npm run contract:check` validates them). Product, listing and home `Seo` blocks are in their own fixtures.
 */
import type { Locale, SiteSeo, SitemapPage } from '@/sdk';
import siteAr from './fixtures/v3/seo-site.ar.json';
import siteEn from './fixtures/v3/seo-site.en.json';
import sitemapAr from './fixtures/v3/sitemap-products.ar.json';
import sitemapEn from './fixtures/v3/sitemap-products.en.json';

export const siteSeoFixture = (locale: Locale = 'en') => structuredClone((locale === 'ar' ? siteAr : siteEn).data) as SiteSeo;
export const sitemapProductsFixture = (locale: Locale = 'en') => structuredClone((locale === 'ar' ? sitemapAr : sitemapEn).data) as SitemapPage;
