#!/usr/bin/env node
/**
 * Writes the fixtures of the account pages (address book, orders) from the mock modules, for the
 * component tests (src/test/account-fixtures.ts). Every file is checked against the contract by
 * `npm run contract:check`. After the backend is live, record real answers instead.
 *
 *   node scripts/build-account-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createAccountModule } from './mock/account.mjs';
import { createSettingsModule } from './mock/settings.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const store = createShopperStore();
  const account = createAccountModule(store);
  account.reset();
  const settings = createSettingsModule(store);
  const call = (method, pathname, body = null, query = '') =>
    [account, settings].map((part) => part.handle({ method, pathname, query: new URLSearchParams(query), token: 'test-customer', locale, body })).find(Boolean)[1];

  // the address form of the store, and a second address the store does not deliver to
  write(`address-form-settings.${locale}`, call('GET', '/checkout/settings'));
  write(`address-locations.${locale}`, call('GET', '/locations'));
  call('POST', '/addresses', { cityId: 2, areaId: 22, districtId: null, values: { label: 'Work', street: 'Desert Rd', building: '4', floor: null, apartment: null, phone: '01000000002' } });
  write(`addresses.${locale}`, call('GET', '/addresses'));

  write(`orders.${locale}`, call('GET', '/orders', null, 'perPage=10'));
  write(`order.${locale}`, call('GET', '/orders/mock-order-48201'));
  write(`order-delivered.${locale}`, call('GET', '/orders/mock-order-48200'));
  write(`order-pickup.${locale}`, call('GET', '/orders/mock-order-48199'));
  write(`cancellation-reasons.${locale}`, call('GET', '/orders/cancellation-reasons'));
  write(`reorder.${locale}`, call('POST', '/orders/mock-order-48200/reorder'));
}
