/**
 * Checkout API responses used by tests. They come from the contract-checked mock
 * (`node scripts/build-checkout-fixtures.mjs`) until they are recorded live.
 */
import type { Checkout, CheckoutResult, CheckoutSettings, Locale, PickupBranch } from '@/sdk';
import firstAr from './fixtures/v3/checkout-first.ar.json';
import firstEn from './fixtures/v3/checkout-first.en.json';
import guestAr from './fixtures/v3/checkout-guest.ar.json';
import guestEn from './fixtures/v3/checkout-guest.en.json';
import pickupAr from './fixtures/v3/checkout-pickup.ar.json';
import pickupEn from './fixtures/v3/checkout-pickup.en.json';
import failedAr from './fixtures/v3/checkout-result-failed.ar.json';
import failedEn from './fixtures/v3/checkout-result-failed.en.json';
import pendingAr from './fixtures/v3/checkout-result-pending.ar.json';
import pendingEn from './fixtures/v3/checkout-result-pending.en.json';
import placedAr from './fixtures/v3/checkout-result.ar.json';
import placedEn from './fixtures/v3/checkout-result.en.json';
import readyAr from './fixtures/v3/checkout.ar.json';
import readyEn from './fixtures/v3/checkout.en.json';
import branchesAr from './fixtures/v3/pickup-branches.ar.json';
import branchesEn from './fixtures/v3/pickup-branches.en.json';

type ByLocale = Record<Locale, { data: unknown }>;
const pick = <T,>(files: ByLocale, locale: Locale): T => structuredClone(files[locale].data) as T;

/** Ready to place: delivery to the default address (25 EGP), cash on delivery, total 381 EGP. */
export const checkoutFixture = (locale: Locale = 'en') => pick<Checkout>({ en: readyEn, ar: readyAr }, locale);
/** The seeded customer's first call: below the minimum order, no payment method yet. */
export const firstCheckoutFixture = (locale: Locale = 'en') => pick<Checkout>({ en: firstEn, ar: firstAr }, locale);
/** Pickup from branch 71, installments without a plan yet, promo code SAVE10 applied. */
export const pickupCheckoutFixture = (locale: Locale = 'en') => pick<Checkout>({ en: pickupEn, ar: pickupAr }, locale);
/** A guest with nothing filled in: contact, fulfilment and payment are missing. */
export const guestCheckoutFixture = (locale: Locale = 'en') => pick<Checkout>({ en: guestEn, ar: guestAr }, locale);
export const pickupBranchesFixture = (locale: Locale = 'en') => pick<{ items: PickupBranch[] }>({ en: branchesEn, ar: branchesAr }, locale).items;

const RESULTS = {
  placed: { en: placedEn, ar: placedAr },
  pending: { en: pendingEn, ar: pendingAr },
  failed: { en: failedEn, ar: failedAr },
};
export const checkoutResultFixture = (status: keyof typeof RESULTS, locale: Locale = 'en') => pick<CheckoutResult>(RESULTS[status], locale);

/** `GET /checkout/settings` of the mock store (scripts/mock/settings.mjs). */
export function checkoutSettingsFixture(overrides: Partial<CheckoutSettings> = {}): CheckoutSettings {
  return {
    guestCheckout: true,
    guestEmail: 'optional',
    pickup: { enabled: true, label: 'Click & Collect' },
    promoCode: true,
    orderNote: true,
    notice: 'Orders placed before 6 pm are delivered the same day.',
    addressForm: { levels: ['city', 'area'], fields: [] },
    ...overrides,
  };
}
