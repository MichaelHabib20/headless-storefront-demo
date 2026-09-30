#!/usr/bin/env node
/** Fails (exit 1) when code breaks the storefront's architecture rules or src/money was changed. */
import fs from 'node:fs';
import path from 'node:path';
import { checkMoneyLock, LOCK_MESSAGE } from './lib/money-lock.mjs';
import { checkSource } from './lib/rules.mjs';

const root = process.cwd();

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'generated', 'fixtures'].includes(entry.name)) yield* walk(full);
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      yield full;
    }
  }
}

const violations = [];
for (const full of walk(path.join(root, 'src'))) {
  const file = path.relative(root, full).split(path.sep).join('/');
  violations.push(...checkSource(file, fs.readFileSync(full, 'utf8')));
}

const lockChanges = checkMoneyLock(root);

if (violations.length) {
  console.error(`✗ ${violations.length} rule violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]\n    ${v.text}\n    → ${v.message}\n`);
  }
}
if (lockChanges.length) {
  console.error(`✗ src/money is locked [money-lock]:\n`);
  for (const c of lockChanges) console.error(`  ${c.change.padEnd(8)} ${c.file}`);
  console.error(`\n    → ${LOCK_MESSAGE}\n`);
}
if (violations.length || lockChanges.length) process.exit(1);
console.log('✓ Architecture rules passed (src/money unchanged).');
