/**
 * src/money is maintained by SuperCommerce (it will become an npm package). Every file in it is
 * pinned by its sha256 in scripts/money.lock.json; `npm run check:rules` fails when a file there
 * is changed, added or removed. Line endings and a BOM are ignored, so Windows and Linux agree.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MONEY_DIR = 'src/money';
export const MONEY_LOCK = 'scripts/money.lock.json';

/** sha256 of a file's text with LF line endings and no BOM. */
export function hashContent(buffer) {
  const text = buffer.toString('utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** { 'src/money/Money.tsx': '<sha256>', … } for every file in the folder, sorted by path. */
export function hashFolder(root, dir = MONEY_DIR) {
  const hashes = {};
  const walk = (relative) => {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) return;
    // plain code-unit order: the same on every machine, whatever its locale
    const entries = fs.readdirSync(full, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else hashes[child] = hashContent(fs.readFileSync(path.join(root, child)));
    }
  };
  walk(dir);
  return hashes;
}

/** Differences between the lock and the folder; empty when they match. */
export function compareHashes(locked, actual) {
  const changes = [];
  for (const file of Object.keys(locked)) {
    if (!(file in actual)) changes.push({ file, change: 'removed' });
    else if (actual[file] !== locked[file]) changes.push({ file, change: 'changed' });
  }
  for (const file of Object.keys(actual)) {
    if (!(file in locked)) changes.push({ file, change: 'added' });
  }
  return changes.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** What differs between src/money and the lock (a missing lock is one change). */
export function checkMoneyLock(root) {
  const lockPath = path.join(root, MONEY_LOCK);
  if (!fs.existsSync(lockPath)) return [{ file: MONEY_LOCK, change: 'missing' }];
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  return compareHashes(lock.files ?? {}, hashFolder(root));
}

/** Writes the lock from the folder as it is now. SuperCommerce maintainers only. */
export function writeMoneyLock(root) {
  const lock = {
    about: 'sha256 of every file in src/money (SuperCommerce money components). Checked by `npm run check:rules`. Regenerated only by SuperCommerce maintainers with `npm run money:lock`.',
    files: hashFolder(root),
  };
  const file = path.join(root, MONEY_LOCK);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(lock, null, 2) + '\n');
  return lock;
}

export const LOCK_MESSAGE = [
  'src/money is maintained by SuperCommerce and must not be edited (see src/money/README.md).',
  'Undo the changes above. To change how money LOOKS, pass className / classNames / as to <Money> / <Price> / <DiscountLabel> from your own components.',
  'Need something they cannot do? Report it to SuperCommerce — do not copy the components and do not regenerate the lock.',
].join('\n    ');
