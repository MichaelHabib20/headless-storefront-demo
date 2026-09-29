#!/usr/bin/env node
/** Fails (exit 1) when code breaks the storefront's architecture rules. */
import fs from 'node:fs';
import path from 'node:path';
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

if (violations.length) {
  console.error(`✗ ${violations.length} rule violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]\n    ${v.text}\n    → ${v.message}\n`);
  }
  process.exit(1);
}
console.log('✓ Architecture rules passed.');
