#!/usr/bin/env node
/**
 * SUPERCOMMERCE MAINTAINERS ONLY. Rewrites scripts/money.lock.json from src/money as it is now,
 * after SuperCommerce changed the money components. Storefront developers (and AI agents) never
 * run this: if the lock check fails, undo the change to src/money instead.
 */
import { MONEY_LOCK, writeMoneyLock } from './lib/money-lock.mjs';

const lock = writeMoneyLock(process.cwd());
console.log(`wrote ${MONEY_LOCK} (${Object.keys(lock.files).length} files) — SuperCommerce maintainers only`);
