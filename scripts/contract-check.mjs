#!/usr/bin/env node
/**
 * Contract check — fails (exit 1) when:
 *  1. a recorded response (src/test/fixtures/v3) does not match contract/openapi.yaml
 *  2. with --live: the running API does not match the contract
 *  3. src/sdk/generated/api.ts is stale (contract changed, types not regenerated)
 *  4. the backend repo is next to this one and its contract differs from ours
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const contractPath = path.join(root, 'contract/openapi.yaml');
const live = process.argv.includes('--live');
const failures = [];

const contract = YAML.parse(fs.readFileSync(contractPath, 'utf8'));
const validate = createValidator(contract);
const SCHEMA = { layout: 'Layout', home: 'Home' };

function check(label, endpoint, body) {
  if (!body || typeof body !== 'object' || !('data' in body)) {
    failures.push(`${label}: not a {data} envelope`);
    return;
  }
  const errors = validate(SCHEMA[endpoint], body.data);
  if (errors.length) failures.push(`${label}:\n    ${errors.slice(0, 15).join('\n    ')}`);
  else console.log(`✓ ${label} matches the contract`);
}

// 1. recorded fixtures
for (const endpoint of Object.keys(SCHEMA)) {
  for (const locale of ['en', 'ar']) {
    const file = path.join(root, `src/test/fixtures/v3/${endpoint}.${locale}.json`);
    check(`fixture ${endpoint}.${locale}`, endpoint, JSON.parse(fs.readFileSync(file, 'utf8')));
  }
}

// 1b. shopper fixtures (whole response bodies)
const RESPONSE_SCHEMA = {
  me: 'MeResponse',
  cart: 'CartResponse',
  'cart-empty': 'CartResponse',
  wishlist: 'WishlistResponse',
  compare: 'CompareResponse',
  notifications: 'NotificationsResponse',
  // product page (scripts/build-product-fixtures.mjs)
  product: 'ProductDetailsResponse',
  'product-out-of-stock': 'ProductDetailsResponse',
  'product-discounted': 'ProductDetailsResponse',
  'product-gallery': 'ProductDetailsResponse',
  'product-recommendations': 'ProductRecommendationsResponse',
  'product-reviews': 'ProductReviewsResponse',
  'product-reviews-disabled': 'ProductReviewsResponse',
  products: 'ProductListingResponse',
  'products-empty': 'ProductListingResponse',
  'search-suggestions': 'SearchSuggestionsResponse',
  categories: 'CategoriesResponse',
  brands: 'BrandsResponse',
  // checkout (scripts/build-checkout-fixtures.mjs)
  checkout: 'CheckoutResponse',
  'checkout-first': 'CheckoutResponse',
  'checkout-pickup': 'CheckoutResponse',
  'checkout-guest': 'CheckoutResponse',
  'checkout-result': 'CheckoutResultResponse',
  'checkout-result-pending': 'CheckoutResultResponse',
  'checkout-result-failed': 'CheckoutResultResponse',
  'pickup-branches': 'PickupBranchesResponse',
  // account pages (scripts/build-account-fixtures.mjs)
  'address-form-settings': 'CheckoutSettingsResponse',
  'address-locations': 'LocationsResponse',
  addresses: 'AddressesResponse',
  orders: 'OrdersResponse',
  order: 'OrderResponse',
  'order-delivered': 'OrderResponse',
  'order-pickup': 'OrderResponse',
  'cancellation-reasons': 'CancellationReasonsResponse',
  reorder: 'ReorderResponse',
  // seo + marketing (scripts/build-seo-fixtures.mjs)
  'seo-site': 'SiteSeoResponse',
  'sitemap-products': 'SitemapResponse',
};
for (const file of fs.readdirSync(path.join(root, 'src/test/fixtures/v3'))) {
  const name = file.replace(/\.(en|ar|anonymous)\.json$/, '');
  if (!RESPONSE_SCHEMA[name]) continue;
  const errors = validate(RESPONSE_SCHEMA[name], JSON.parse(fs.readFileSync(path.join(root, 'src/test/fixtures/v3', file), 'utf8')));
  if (errors.length) failures.push(`fixture ${file}:\n    ${errors.slice(0, 15).join('\n    ')}`);
  else console.log(`✓ fixture ${file} matches the contract`);
}

// 2. live API
if (live) {
  const base = (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com').replace(/\/+$/, '');
  const headers = (locale, token) => ({ Accept: 'application/json', 'Accept-Language': locale, 'device-type': 'web', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  for (const endpoint of Object.keys(SCHEMA)) {
    for (const locale of ['en', 'ar']) {
      const res = await fetch(`${base}/api/customer/v3/${endpoint}`, { headers: headers(locale) });
      if (!res.ok) failures.push(`live ${endpoint}.${locale}: HTTP ${res.status}`);
      else check(`live ${endpoint}.${locale}`, endpoint, await res.json());
    }
  }

  // Shopper endpoints (read-only), signed in as the staging test account when available.
  const liveResponse = async (label, schema, path, token, locale = 'en', expected = 200) => {
    const res = await fetch(`${base}/api/customer/v3/${path}`, { headers: headers(locale, token) });
    const body = await res.json().catch(() => null);
    if (res.status !== expected) return failures.push(`live ${label}: HTTP ${res.status}, expected ${expected}`);
    const errors = validate(schema, body);
    if (errors.length) failures.push(`live ${label}:\n    ${errors.slice(0, 15).join('\n    ')}`);
    else console.log(`✓ live ${label} matches the contract`);
  };
  await liveResponse('me (anonymous)', 'MeResponse', 'me');
  await liveResponse('cart without a session → 401', 'ErrorResponse', 'cart', null, 'en', 401);
  const { E2E_PHONE: phone, E2E_PASSWORD: password } = process.env;
  if (phone && password) {
    const login = await (await fetch(`${base}/api/customer/auth`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', lang: '1' }, body: JSON.stringify({ phone, password }) })).json();
    const token = login?.data?.token;
    if (!token) failures.push('live sign-in with E2E_PHONE/E2E_PASSWORD failed');
    else {
      for (const locale of ['en', 'ar']) {
        await liveResponse(`me.${locale}`, 'MeResponse', 'me', token, locale);
        await liveResponse(`cart.${locale}`, 'CartResponse', 'cart', token, locale);
        await liveResponse(`wishlist.${locale}`, 'WishlistResponse', 'wishlist?perPage=5', token, locale);
        await liveResponse(`compare.${locale}`, 'CompareResponse', 'compare', token, locale);
        await liveResponse(`notifications.${locale}`, 'NotificationsResponse', 'notifications?perPage=5', token, locale);
      }
    }
  } else {
    console.log('(skipping signed-in live checks: set E2E_PHONE / E2E_PASSWORD)');
  }
}

// 3. generated types are up to date
const tmp = path.join(os.tmpdir(), `sc-api-${process.pid}.ts`);
execFileSync(process.execPath, [path.join(root, 'node_modules/openapi-typescript/bin/cli.js'), contractPath, '-o', tmp], { stdio: 'ignore' });
const normalize = (s) => s.replace(/\r\n/g, '\n').trim();
if (normalize(fs.readFileSync(tmp, 'utf8')) !== normalize(fs.readFileSync(path.join(root, 'src/sdk/generated/api.ts'), 'utf8'))) {
  failures.push('src/sdk/generated/api.ts is stale: run `npm run contract:types`');
} else {
  console.log('✓ generated SDK types match the contract');
}
fs.rmSync(tmp, { force: true });

// 4. same contract as the backend (when both repos are checked out side by side). SC_BACKEND_DIR
//    points at another backend checkout (e.g. the worktree a contract change is being made in).
const backendDir = process.env.SC_BACKEND_DIR ? path.resolve(process.env.SC_BACKEND_DIR) : path.join(root, '../saas-ecommerce-backend');
const backendContract = path.join(backendDir, 'docs/headless/openapi.yaml');
if (fs.existsSync(backendContract)) {
  if (normalize(fs.readFileSync(backendContract, 'utf8')) !== normalize(fs.readFileSync(contractPath, 'utf8'))) {
    failures.push('contract/openapi.yaml differs from the backend contract: run `npm run contract:sync`');
  } else {
    console.log('✓ contract is in sync with the backend');
  }
}

if (failures.length) {
  console.error(`\n✗ Contract check failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nContract check passed.');
