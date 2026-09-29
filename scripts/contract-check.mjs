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

// 2. live API
if (live) {
  const base = (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com').replace(/\/+$/, '');
  for (const endpoint of Object.keys(SCHEMA)) {
    for (const locale of ['en', 'ar']) {
      const res = await fetch(`${base}/api/customer/v3/${endpoint}`, { headers: { Accept: 'application/json', 'Accept-Language': locale } });
      if (!res.ok) failures.push(`live ${endpoint}.${locale}: HTTP ${res.status}`);
      else check(`live ${endpoint}.${locale}`, endpoint, await res.json());
    }
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

// 4. same contract as the backend (when both repos are checked out side by side)
const backendContract = path.join(root, '../saas-ecommerce-backend/docs/headless/openapi.yaml');
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
