#!/usr/bin/env node
/**
 * Writes the fixtures of the auth and profile pages from the mock auth module, for the component
 * tests (src/test/auth-fixtures.ts). Every file is checked against the contract by
 * `npm run contract:check`. After the backend is live, record real answers instead.
 *
 *   node scripts/build-auth-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createAuthModule } from './mock/auth.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const auth = createAuthModule(createShopperStore());
  const call = (method, pathname, body = null, token = 'test-customer') => auth.handle({ method, pathname, query: new URLSearchParams(), token, locale, body })[1];

  // the staging-like store: phone login, e-mail optional, birthdate, SMS reset, no social / OTP
  write(`auth-settings.${locale}`, call('GET', '/auth/settings', null, null));
  write(`session.${locale}`, call('POST', '/auth/sign-in', { identifier: '01222353123', password: 'secret123' }, null));
  write(`profile.${locale}`, call('GET', '/account/profile'));

  // everything on: OTP, Google + Facebook, e-mail reset, referral, customer groups, approval, verify after sign-up
  auth.mode({ auth: { otpLogin: true, social: { google: { clientId: 'google-client-id' }, facebook: { appId: 'fb-app-id' } }, passwordReset: 'email', referral: true, customerGroups: true, approval: true, verifyPhoneAfterSignup: true } });
  write(`auth-settings-full.${locale}`, call('GET', '/auth/settings', null, null));
}
