#!/usr/bin/env node
/**
 * Writes the loyalty fixtures from the mock (src/test/loyalty-fixtures.ts), for the component tests.
 * `npm run contract:check` validates every file against the contract.
 *
 *   node scripts/build-loyalty-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLoyaltyModule } from './mock/loyalty.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};
const request = (locale, pathname, method = 'GET') => ({ method, pathname, locale, query: new URLSearchParams(), token: 'test-customer', body: null, headers: {} });

for (const locale of ['en', 'ar']) {
  const loyalty = createLoyaltyModule(createShopperStore());
  loyalty.mode({ loyalty: { provider: 'elDokan' } });
  write(`loyalty-summary.${locale}`, loyalty.handle(request(locale, '/loyalty'))[1]);
  write(`loyalty-rewards.${locale}`, loyalty.handle(request(locale, '/loyalty/rewards'))[1]);
  write(`loyalty-reward.${locale}`, loyalty.handle(request(locale, '/loyalty/rewards/3'))[1]);
  write(`loyalty-history.${locale}`, loyalty.handle(request(locale, '/loyalty/history'))[1]);
  write(`loyalty-referral.${locale}`, loyalty.handle(request(locale, '/loyalty/referral'))[1]);
  write(`loyalty-redeemed.${locale}`, loyalty.handle(request(locale, '/loyalty/rewards/3/redeem', 'POST'))[1]);
  loyalty.mode({ loyalty: { phone: 'unverified' } });
  write(`loyalty-rewards-blocked.${locale}`, loyalty.handle(request(locale, '/loyalty/rewards'))[1]);
  loyalty.mode({ loyalty: { provider: 'ivend', phone: 'ok' } });
  write(`loyalty-summary-ivend.${locale}`, loyalty.handle(request(locale, '/loyalty'))[1]);
}
