import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkMoneyLock, hashContent, MONEY_LOCK, writeMoneyLock } from './lib/money-lock.mjs';

/** A throwaway repo with its own src/money, so the real folder is never touched. */
let root;
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'money-lock-'));
  write('src/money/Money.tsx', 'export function Money() {}\n');
  write('src/money/README.md', '# money\n');
  write('src/money/parts/Price.tsx', 'export function Price() {}\n');
  writeMoneyLock(root);
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('money lock', () => {
  it('passes when src/money matches the lock', () => {
    expect(checkMoneyLock(root)).toEqual([]);
    const lock = JSON.parse(fs.readFileSync(path.join(root, MONEY_LOCK), 'utf8'));
    expect(Object.keys(lock.files)).toEqual(['src/money/Money.tsx', 'src/money/README.md', 'src/money/parts/Price.tsx']);
  });

  it('fails when a file is changed', () => {
    write('src/money/parts/Price.tsx', 'export function Price() { return "EGP " + 1; }\n');
    expect(checkMoneyLock(root)).toEqual([{ file: 'src/money/parts/Price.tsx', change: 'changed' }]);
  });

  it('fails when a file is added', () => {
    write('src/money/formatMoney.ts', 'export const formatMoney = () => "";\n');
    expect(checkMoneyLock(root)).toEqual([{ file: 'src/money/formatMoney.ts', change: 'added' }]);
  });

  it('fails when a file is removed', () => {
    fs.rmSync(path.join(root, 'src/money/README.md'));
    expect(checkMoneyLock(root)).toEqual([{ file: 'src/money/README.md', change: 'removed' }]);
  });

  it('fails when the lock is missing', () => {
    fs.rmSync(path.join(root, MONEY_LOCK));
    expect(checkMoneyLock(root)).toEqual([{ file: MONEY_LOCK, change: 'missing' }]);
  });

  it('ignores line endings and a BOM (Windows and Linux agree)', () => {
    write('src/money/Money.tsx', '﻿export function Money() {}\r\n');
    expect(checkMoneyLock(root)).toEqual([]);
    expect(hashContent(Buffer.from('a\r\nb\n'))).toBe(hashContent(Buffer.from('a\nb\n')));
    expect(hashContent(Buffer.from('a\nb\n'))).not.toBe(hashContent(Buffer.from('a\nc\n')));
  });

  it('matches the real src/money of this repo', () => {
    expect(checkMoneyLock(process.cwd())).toEqual([]);
  });
});
