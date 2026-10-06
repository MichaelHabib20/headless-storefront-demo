#!/usr/bin/env node
/**
 * Writes the wallet fixtures from the mock (src/test/wallet-fixtures.ts), for the component tests.
 * `npm run contract:check` validates every file against the contract.
 *
 *   node scripts/build-wallet-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCheckoutModule, PAYMENT } from './mock/checkout.mjs';
import { createShopperStore } from './mock/shopper.mjs';
import { createWalletModule } from './mock/wallet.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const fresh = (balance, empty = false) => {
    const store = createShopperStore();
    if (empty) store.session('test-customer').wallet = { balance: 0, rows: [] };
    const checkout = createCheckoutModule(store);
    checkout.reset();
    const wallet = createWalletModule(store);
    wallet.mode({ wallet: { on: true, balance } });
    const call = (method, pathname, body = null, token = 'test-customer') => {
      const request = { method, pathname, locale, query: new URLSearchParams(), token, body, contentType: '', headers: {}, raw: '' };
      return (wallet.handle(request) ?? checkout.handle(request) ?? store.handle(request))[1];
    };
    call('PUT', '/cart/items/7346', { quantity: 2 });
    return call;
  };

  const call = fresh(150);
  write(`wallet.${locale}`, call('GET', '/wallet'));
  write(`checkout-wallet-part.${locale}`, call('POST', '/checkout', { fulfilment: 'delivery', paymentMethodId: PAYMENT.cash, useWallet: true }));
  write(`checkout-wallet-all.${locale}`, fresh(500)('POST', '/checkout', { fulfilment: 'delivery', useWallet: true }));

  // a customer without wallet activity
  write(`wallet-empty.${locale}`, fresh(0, true)('GET', '/wallet'));
}
