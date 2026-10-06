/**
 * Voucher answers used by tests, generated from the contract-checked mock
 * (`node scripts/build-vouchers-fixtures.mjs`; `npm run contract:check` validates them).
 */
import type { Checkout, Locale, VoucherAdded, Vouchers } from '@/sdk';
import addedAr from './fixtures/v3/voucher-added.ar.json';
import addedEn from './fixtures/v3/voucher-added.en.json';
import suggestionsAr from './fixtures/v3/checkout-voucher-suggestions.ar.json';
import suggestionsEn from './fixtures/v3/checkout-voucher-suggestions.en.json';
import vouchersAr from './fixtures/v3/vouchers.ar.json';
import vouchersEn from './fixtures/v3/vouchers.en.json';

const pick = <T>(locale: Locale, ar: { data: unknown }, en: { data: unknown }) => structuredClone((locale === 'ar' ? ar : en).data) as T;

/** FREEDEL and SAVE10 active, ONCE used, OLD expired. */
export const vouchersFixture = (locale: Locale = 'en') => pick<Vouchers>(locale, vouchersAr, vouchersEn);
/** WELCOME20 added: the message and the new list. */
export const voucherAddedFixture = (locale: Locale = 'en') => pick<VoucherAdded>(locale, addedAr, addedEn);
/** A checkout (delivery, cash) whose promo offers FREEDEL and SAVE10. */
export const voucherSuggestionsCheckoutFixture = (locale: Locale = 'en') => pick<Checkout>(locale, suggestionsAr, suggestionsEn);
