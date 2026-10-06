#!/usr/bin/env node
/**
 * Writes the vouchers fixtures from the mock (src/test/vouchers-fixtures.ts), for the component tests.
 * `npm run contract:check` validates every file against the contract.
 *
 *   node scripts/build-vouchers-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCheckoutModule } from './mock/checkout.mjs';
import { createShopperStore } from './mock/shopper.mjs';
import { createVouchersModule } from './mock/vouchers.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const store = createShopperStore();
  const checkout = createCheckoutModule(store);
  checkout.reset();
  const vouchers = createVouchersModule(store);
  vouchers.mode({ vouchers: { on: true } });
  const call = (method, pathname, body = null) => {
    const request = { method, pathname, locale, query: new URLSearchParams(), token: 'test-customer', body, contentType: '', headers: {}, raw: '' };
    return (vouchers.handle(request) ?? checkout.handle(request) ?? store.handle(request))[1];
  };
  write(`vouchers.${locale}`, call('GET', '/vouchers'));
  write(`checkout-voucher-suggestions.${locale}`, call('POST', '/checkout', { fulfilment: 'delivery', paymentMethodId: 1 }));
  write(`voucher-added.${locale}`, call('POST', '/vouchers', { code: 'WELCOME20' }));
}
