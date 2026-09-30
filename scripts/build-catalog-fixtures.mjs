#!/usr/bin/env node
/**
 * Writes fixtures for the listing, search, categories and brands endpoints (used by component
 * tests) from the mock catalog module. After the backend is live, `npm run fixtures:record`
 * can replace them with real recorded responses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCatalogModule } from './mock/catalog.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, [status, body]) => {
  if (status !== 200) throw new Error(`${name}: mock answered ${status}`);
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

const catalog = createCatalogModule(createShopperStore());
for (const locale of ['en', 'ar']) {
  const get = (pathname, query = '') => catalog.handle({ method: 'GET', pathname, query: new URLSearchParams(query), token: null, locale, body: null });

  // A category with a text and an image, a color filter in use, sorted, 2 per page (2 pages).
  write(`products.${locale}`, get('/products', 'category=mom-baby&options=color-lavender&sort=price_asc&perPage=2'));
  write(`products-empty.${locale}`, get('/products', 'q=zzzz'));
  write(`search-suggestions.${locale}`, get('/search/suggestions', 'q=johnson'));
  write(`categories.${locale}`, get('/categories'));
  write(`brands.${locale}`, get('/brands', 'perPage=24'));
}
