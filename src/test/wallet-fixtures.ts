/**
 * Wallet answers used by tests, generated from the contract-checked mock
 * (`node scripts/build-wallet-fixtures.mjs`; `npm run contract:check` validates them).
 */
import type { Checkout, Locale, Wallet } from '@/sdk';
import partAr from './fixtures/v3/checkout-wallet-part.ar.json';
import partEn from './fixtures/v3/checkout-wallet-part.en.json';
import allAr from './fixtures/v3/checkout-wallet-all.ar.json';
import allEn from './fixtures/v3/checkout-wallet-all.en.json';
import emptyAr from './fixtures/v3/wallet-empty.ar.json';
import emptyEn from './fixtures/v3/wallet-empty.en.json';
import walletAr from './fixtures/v3/wallet.ar.json';
import walletEn from './fixtures/v3/wallet.en.json';

const pick = <T>(locale: Locale, ar: { data: unknown }, en: { data: unknown }) => structuredClone((locale === 'ar' ? ar : en).data) as T;

/** 150 EGP: 200 added by the store, 50 paid for order #48200 (newest first). */
export const walletFixture = (locale: Locale = 'en') => pick<Wallet>(locale, walletAr, walletEn);
/** 0 EGP, no history. */
export const emptyWalletFixture = (locale: Locale = 'en') => pick<Wallet>(locale, emptyAr, emptyEn);
/** Checkout of 381 EGP (cash, delivery) with the 150 EGP wallet used: 231 left to pay. */
export const walletPartCheckoutFixture = (locale: Locale = 'en') => pick<Checkout>(locale, partAr, partEn);
/** The same order with 500 EGP in the wallet: it pays everything, no payment method is shown. */
export const walletAllCheckoutFixture = (locale: Locale = 'en') => pick<Checkout>(locale, allAr, allEn);
