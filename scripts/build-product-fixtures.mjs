#!/usr/bin/env node
/**
 * Writes the product page fixtures (used by component tests) from the mock product module
 * (scripts/mock/product.mjs). `npm run contract:check` validates them. Once the backend serves
 * these endpoints, record real answers instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createProductModule } from './mock/product.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const store = createShopperStore();
  const product = createProductModule(store);
  const slug = (id) => encodeURIComponent(store.product(id, locale).slug);
  const call = (pathname, query = '') => product.handle({ method: 'GET', pathname, query: new URLSearchParams(query), token: null, locale, body: null })[1];

  write(`product.${locale}`, call(`/products/${slug(9822)}`)); // options, rating, notices
  write(`product-out-of-stock.${locale}`, call(`/products/${slug(14400)}`)); // notify-me
  write(`product-discounted.${locale}`, call(`/products/${slug(8658)}`)); // sale price, dropdown option
  write(`product-gallery.${locale}`, call(`/products/${slug(36480)}`)); // 4 images + video
  write(`product-recommendations.${locale}`, call(`/products/${slug(9822)}/recommendations`));
  write(`product-reviews.${locale}`, call(`/products/${slug(9822)}/reviews`, 'perPage=5'));
  write(`product-reviews-disabled.${locale}`, call(`/products/${slug(33594)}/reviews`, 'perPage=5'));
}
