#!/usr/bin/env node
/**
 * SEO + marketing fixtures (used by unit and component tests; `npm run contract:check` validates them):
 *   seo-site.{en,ar}.json          GET /seo/site of the mock (every fact, LocalBusiness included)
 *   sitemap-products.{en,ar}.json  GET /sitemap?type=products of the mock
 *   layout.{en,ar}.json            + `marketing` with the staging ids (the recorded layout predates it)
 *   home.{en,ar}.json              + `seo` (the recorded home predates it)
 * The product and listing fixtures get their SEO members from scripts/build-product-fixtures.mjs and
 * scripts/build-catalog-fixtures.mjs (the mock modules add them). Once the backend serves this phase,
 * record real answers instead (`npm run fixtures:record`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSeoModule, homeSeo } from './mock/seo.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const read = (name) => JSON.parse(fs.readFileSync(path.join(out, `${name}.json`), 'utf8'));
const write = (name, body, indent = 1) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, indent) + '\n');
  console.log(`wrote ${name}.json`);
};

/** Layout.marketing as staging answers it (remaining.md "Flags on for staging"). */
const STAGING_MARKETING = {
  gtmId: 'GTM-TZC4S7KD',
  googleAnalyticsIds: ['G-BVSC667874'],
  googleAds: null,
  facebookPixelId: '882598886877502',
  tiktokPixelId: 'D072PMBC77UCMMV6DJM0',
  snapchatPixelId: null,
  clarityId: null,
  hotjarId: null,
};

const seo = createSeoModule(createShopperStore());
const call = (pathname, locale, query = '') => seo.handle({ method: 'GET', pathname, query: new URLSearchParams(query), token: null, locale, body: null })[1];

for (const locale of ['en', 'ar']) {
  write(`seo-site.${locale}`, call('/seo/site', locale));
  write(`sitemap-products.${locale}`, call('/sitemap', locale, 'type=products&perPage=5'));

  // The recorded files keep their own formatting; only this phase's key is added or replaced.
  const layout = read(`layout.${locale}`);
  layout.data.marketing = STAGING_MARKETING;
  write(`layout.${locale}`, layout);
  const home = read(`home.${locale}`);
  home.data.seo = homeSeo(locale);
  write(`home.${locale}`, home);
}
