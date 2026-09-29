#!/usr/bin/env node
/**
 * Records real v3 responses into src/test/fixtures/v3 (used by component tests,
 * the contract check and the e2e mock API).
 *   npm run fixtures:record                 → layout + home
 *   npm run fixtures:record -- --shopper    → also me / cart / wishlist / compare / notifications,
 *                                             signed in as E2E_PHONE / E2E_PASSWORD (read-only calls)
 */
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com').replace(/\/+$/, '');
const out = path.resolve('src/test/fixtures/v3');
fs.mkdirSync(out, { recursive: true });

async function call(method, endpoint, locale, token, query = '') {
  const headers = { Accept: 'application/json', 'Accept-Language': locale };
  if (process.env.SC_API_KEY) headers['api-key'] = process.env.SC_API_KEY;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/api/customer/v3/${endpoint}${query ? `?${query}` : ''}`, { method, headers });
  if (!res.ok) throw new Error(`${method} ${endpoint}.${locale}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

function save(name, body) {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`recorded ${name}`);
}

for (const endpoint of ['layout', 'home']) {
  for (const locale of ['en', 'ar']) save(`${endpoint}.${locale}`, await call('GET', endpoint, locale));
}

if (process.argv.includes('--shopper')) {
  const { E2E_PHONE: phone, E2E_PASSWORD: password } = process.env;
  if (!phone || !password) throw new Error('--shopper needs E2E_PHONE and E2E_PASSWORD');
  const login = await (
    await fetch(`${base}/api/customer/auth`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', lang: '1' },
      body: JSON.stringify({ phone, password }),
    })
  ).json();
  if (login.code !== 200) throw new Error(`sign-in failed: ${login.code}`);
  const token = login.data.token;

  save('me.anonymous', await call('GET', 'me', 'en', null));
  for (const locale of ['en', 'ar']) {
    save(`me.${locale}`, await call('GET', 'me', locale, token));
    save(`cart.${locale}`, await call('GET', 'cart', locale, token));
    save(`wishlist.${locale}`, await call('GET', 'wishlist', locale, token, 'perPage=2'));
    save(`compare.${locale}`, await call('GET', 'compare', locale, token));
    save(`notifications.${locale}`, await call('GET', 'notifications', locale, token, 'perPage=10'));
  }
  // A fresh guest has an empty cart (this POST creates one guest session on staging).
  const guest = (await call('POST', 'session/guest', 'en', null)).data.token;
  for (const locale of ['en', 'ar']) save(`cart-empty.${locale}`, await call('GET', 'cart', locale, guest));
}
