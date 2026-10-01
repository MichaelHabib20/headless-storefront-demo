#!/usr/bin/env node
/**
 * Writes the fixtures of the shell and content pages from the mock modules, for the component tests
 * (src/test/shell-fixtures.ts). Every file is checked against the contract by `npm run contract:check`.
 *
 * - the shell keys of `Layout` (legal, appBanner, topBanner, floatingBanner, mobileNav, areaSelection,
 *   storeStatus) are added to the recorded layout fixtures, with staging's values; nothing else there changes
 * - content-*.json: CMS page, contact page, branches page, branches, landing page, two forms
 *
 *   node scripts/build-shell-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createContentModule } from './mock/content.mjs';
import { shellKeys } from './mock/shell.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const file = path.join(out, `layout.${locale}.json`);
  const layout = JSON.parse(fs.readFileSync(file, 'utf8'));
  layout.data = { ...layout.data, ...shellKeys(locale) };
  fs.writeFileSync(file, JSON.stringify(layout, null, 1) + '\n');
  console.log(`updated layout.${locale}.json (shell keys)`);

  const content = createContentModule(createShopperStore());
  const call = (pathname) => content.handle({ method: 'GET', pathname, query: new URLSearchParams(), token: null, locale, body: null })[1];
  write(`content-page.${locale}`, call('/pages/about-us'));
  write(`content-contact.${locale}`, call('/pages/contact'));
  write(`content-branches-page.${locale}`, call('/pages/branches'));
  write(`content-branches.${locale}`, call('/branches'));
  write(`content-landing.${locale}`, call('/landing-pages/summer-sale'));
  write(`content-form.${locale}`, call('/forms/feedback'));
  write(`content-form-file.${locale}`, call('/forms/prescriptions'));
}
