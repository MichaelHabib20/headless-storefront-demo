#!/usr/bin/env node
/**
 * Writes the insurance fixtures from the mock (src/test/insurance-fixtures.ts), for the component tests.
 * `npm run contract:check` validates every file against the contract.
 *
 *   node scripts/build-insurance-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createInsuranceModule } from './mock/insurance.mjs';
import { createPrescriptionsModule } from './mock/prescriptions.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const store = createShopperStore();
  const insurance = createInsuranceModule(store);
  insurance.mode({ insurance: { on: true } });
  const prescriptions = createPrescriptionsModule(store);
  const call = (pathname) => {
    const request = { method: 'GET', pathname, locale, query: new URLSearchParams(), token: 'test-customer', body: null, headers: {} };
    return (insurance.handle(request) ?? prescriptions.handle(request))[1];
  };
  write(`insurance.${locale}`, call('/insurance'));
  write(`prescription-form-insurance.${locale}`, call('/prescriptions/form'));
}
