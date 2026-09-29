#!/usr/bin/env node
/**
 * Writes static fixtures for the shopper endpoints (used by component tests) from the
 * mock store. After the backend is live, `npm run fixtures:record` replaces them with
 * real recorded responses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const store = createShopperStore();
  const call = (method, pathname, token = 'test-customer', query = '') =>
    store.handle({ method, pathname, query: new URLSearchParams(query), token, locale, body: null })[1];

  write(`me.${locale}`, call('GET', '/me'));
  write(`cart.${locale}`, call('GET', '/cart'));
  write(`wishlist.${locale}`, call('GET', '/wishlist', 'test-customer', 'perPage=2'));
  write(`compare.${locale}`, call('GET', '/compare'));
  write(`notifications.${locale}`, call('GET', '/notifications', 'test-customer', 'perPage=10'));

  const guest = store.handle({ method: 'POST', pathname: '/session/guest', query: new URLSearchParams(), token: null, locale, body: null })[1].data.token;
  write(`cart-empty.${locale}`, call('GET', '/cart', guest));
}

const anon = createShopperStore();
write('me.anonymous', anon.handle({ method: 'GET', pathname: '/me', query: new URLSearchParams(), token: null, locale: 'en', body: null })[1]);
