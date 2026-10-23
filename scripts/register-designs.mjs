#!/usr/bin/env node
/**
 * Sends this storefront's design list (src/designs/sections.json) to the store's backend, which
 * stores it so the admin can offer the designs (section-designs contract §2, §4).
 *   SC_API_URL=https://staging-seif.witheldokan.com STOREFRONT_DESIGNS_KEY=… npm run designs:register
 * Full replace on the backend: designs missing from the file are removed unless a section uses them.
 * Not run in CI. The key is sent as the x-editor-key header and never printed.
 */
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.SC_API_URL ?? '').trim().replace(/\/+$/, '');
const key = process.env.STOREFRONT_DESIGNS_KEY ?? '';
if (!base || !key) {
  console.error('Set SC_API_URL (the store backend) and STOREFRONT_DESIGNS_KEY (its storefront editor key).');
  process.exit(1);
}

const file = path.resolve('src/designs/sections.json');
const body = fs.readFileSync(file, 'utf8');
JSON.parse(body); // fail here on a broken file, before calling the backend

const url = `${base}/api/storefront-designs/register`;
const res = await fetch(url, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-editor-key': key },
  body,
});
const text = await res.text();
let printed = text;
try {
  printed = JSON.stringify(JSON.parse(text), null, 2);
} catch {
  // not JSON: print as is
}
console.log(`POST ${url} → HTTP ${res.status}`);
console.log(printed);
if (!res.ok) process.exit(1);
