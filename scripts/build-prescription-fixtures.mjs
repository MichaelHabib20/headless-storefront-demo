#!/usr/bin/env node
/**
 * Writes the prescription fixtures from the mock rx (src/test/prescription-fixtures.ts), for the
 * component tests. `npm run contract:check` validates every file against the contract.
 *
 *   node scripts/build-prescription-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createPrescriptionsModule } from './mock/prescriptions.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};
const request = (locale, pathname) => ({ method: 'GET', pathname, locale, query: new URLSearchParams(), token: 'test-customer', body: null, headers: {} });

for (const locale of ['en', 'ar']) {
  const rx = createPrescriptionsModule(createShopperStore());
  write(`prescription-form.${locale}`, rx.handle(request(locale, '/prescriptions/form'))[1]);
  write(`prescriptions.${locale}`, rx.handle(request(locale, '/prescriptions'))[1]);
  rx.mode({ prescriptions: { wasfaty: true, phone: 'unverified' } });
  write(`prescription-form-blocked.${locale}`, rx.handle(request(locale, '/prescriptions/form'))[1]);
}
