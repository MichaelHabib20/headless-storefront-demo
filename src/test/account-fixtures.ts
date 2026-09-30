/**
 * API answers for the account pages (address book, orders), generated from the contract-checked
 * mock by `node scripts/build-account-fixtures.mjs` until they are recorded live.
 */
import type { AddressBook, CancellationReasons, CheckoutSettings, Locale, Locations, Order, OrdersPage, ReorderResult } from '@/sdk';
import addressFormAr from './fixtures/v3/address-form-settings.ar.json';
import addressFormEn from './fixtures/v3/address-form-settings.en.json';
import locationsAr from './fixtures/v3/address-locations.ar.json';
import locationsEn from './fixtures/v3/address-locations.en.json';
import addressesAr from './fixtures/v3/addresses.ar.json';
import addressesEn from './fixtures/v3/addresses.en.json';
import reasonsAr from './fixtures/v3/cancellation-reasons.ar.json';
import reasonsEn from './fixtures/v3/cancellation-reasons.en.json';
import orderDeliveredAr from './fixtures/v3/order-delivered.ar.json';
import orderDeliveredEn from './fixtures/v3/order-delivered.en.json';
import orderPickupAr from './fixtures/v3/order-pickup.ar.json';
import orderPickupEn from './fixtures/v3/order-pickup.en.json';
import orderAr from './fixtures/v3/order.ar.json';
import orderEn from './fixtures/v3/order.en.json';
import ordersAr from './fixtures/v3/orders.ar.json';
import ordersEn from './fixtures/v3/orders.en.json';
import reorderAr from './fixtures/v3/reorder.ar.json';
import reorderEn from './fixtures/v3/reorder.en.json';

type ByLocale = Record<Locale, { data: unknown }>;
const pick = <T,>(files: ByLocale, locale: Locale): T => structuredClone(files[locale].data) as T;

/** The store's checkout settings (for `addressForm`: levels city + area, six fields). */
export const checkoutSettingsFixture = (locale: Locale = 'en') => pick<CheckoutSettings>({ en: addressFormEn, ar: addressFormAr }, locale);
/** Cairo (Nasr City, Maadi) and Giza (Dokki, Remote Oasis); no districts. */
export const locationsFixture = (locale: Locale = 'en') => pick<Locations>({ en: locationsEn, ar: locationsAr }, locale);
/** Two addresses: #501 the default in Nasr City, and one in Remote Oasis (`deliverable: false`). */
export const addressesFixture = (locale: Locale = 'en') => pick<AddressBook>({ en: addressesEn, ar: addressesAr }, locale);
/** Page 1 of 2 (10 of 12 orders): in progress, delivered, picked up, cancelled, older ones (one `returned`). */
export const ordersFixture = (locale: Locale = 'en') => pick<OrdersPage>({ en: ordersEn, ar: ordersAr }, locale);
/** #48201 in progress: timeline, delivery address, promo code line, a discounted line, a note, `canCancel`. */
export const orderFixture = (locale: Locale = 'en') => pick<Order>({ en: orderEn, ar: orderAr }, locale);
/** #48200 delivered: `canReorder`, a promotion line, one product that is not sold any more (`target: null`). */
export const deliveredOrderFixture = (locale: Locale = 'en') => pick<Order>({ en: orderDeliveredEn, ar: orderDeliveredAr }, locale);
/** #48199 picked up from a branch: no timeline, the delivery line has `text` instead of an amount. */
export const pickupOrderFixture = (locale: Locale = 'en') => pick<Order>({ en: orderPickupEn, ar: orderPickupAr }, locale);
export const cancellationReasonsFixture = (locale: Locale = 'en') => pick<CancellationReasons>({ en: reasonsEn, ar: reasonsAr }, locale);
/** Reordering #48200: the new cart, and the one skipped product with its reason. */
export const reorderFixture = (locale: Locale = 'en') => pick<ReorderResult>({ en: reorderEn, ar: reorderAr }, locale);
