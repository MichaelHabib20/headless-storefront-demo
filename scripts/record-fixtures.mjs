#!/usr/bin/env node
/**
 * Records real v3 responses into src/test/fixtures/v3 (used by component tests,
 * the contract check and the e2e mock API).
 *   SC_API_URL=https://staging-seif.witheldokan.com npm run fixtures:record
 */
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com').replace(/\/+$/, '');
const out = path.resolve('src/test/fixtures/v3');
fs.mkdirSync(out, { recursive: true });

for (const endpoint of ['layout', 'home']) {
  for (const locale of ['en', 'ar']) {
    const headers = { Accept: 'application/json', 'Accept-Language': locale };
    if (process.env.SC_API_KEY) headers['api-key'] = process.env.SC_API_KEY;
    const res = await fetch(`${base}/api/customer/v3/${endpoint}`, { headers });
    if (!res.ok) throw new Error(`${endpoint}.${locale}: HTTP ${res.status}`);
    const body = await res.json();
    fs.writeFileSync(path.join(out, `${endpoint}.${locale}.json`), JSON.stringify(body, null, 1) + '\n');
    console.log(`recorded ${endpoint}.${locale}`);
  }
}
