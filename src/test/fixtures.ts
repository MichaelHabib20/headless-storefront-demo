/**
 * API responses used by tests. layout/home are recorded from seif-staging
 * (`npm run fixtures:record`); shopper fixtures come from the contract-checked mock
 * (`node scripts/build-shopper-fixtures.mjs`) until they are recorded live.
 */
import type { Cart, CompareData, Home, Layout, Locale, Me, NotificationsPage, WishlistPage } from '@/sdk';
import cartAr from './fixtures/v3/cart.ar.json';
import cartEmptyAr from './fixtures/v3/cart-empty.ar.json';
import cartEmptyEn from './fixtures/v3/cart-empty.en.json';
import cartEn from './fixtures/v3/cart.en.json';
import compareAr from './fixtures/v3/compare.ar.json';
import compareEn from './fixtures/v3/compare.en.json';
import homeAr from './fixtures/v3/home.ar.json';
import homeEn from './fixtures/v3/home.en.json';
import layoutAr from './fixtures/v3/layout.ar.json';
import layoutEn from './fixtures/v3/layout.en.json';
import meAnonymous from './fixtures/v3/me.anonymous.json';
import meAr from './fixtures/v3/me.ar.json';
import meEn from './fixtures/v3/me.en.json';
import notificationsAr from './fixtures/v3/notifications.ar.json';
import notificationsEn from './fixtures/v3/notifications.en.json';
import wishlistAr from './fixtures/v3/wishlist.ar.json';
import wishlistEn from './fixtures/v3/wishlist.en.json';

type ByLocale<T> = Record<Locale, T>;
const pick = <T,>(files: ByLocale<{ data: unknown }>, locale: Locale): T => structuredClone(files[locale].data) as T;

export const homeFixture = (locale: Locale = 'en') => pick<Home>({ en: homeEn, ar: homeAr }, locale);
export const layoutFixture = (locale: Locale = 'en') => pick<Layout>({ en: layoutEn, ar: layoutAr }, locale);
export const meFixture = (locale: Locale = 'en') => pick<Me>({ en: meEn, ar: meAr }, locale);
export const anonymousMeFixture = () => structuredClone(meAnonymous.data) as Me;
export const cartFixture = (locale: Locale = 'en') => pick<Cart>({ en: cartEn, ar: cartAr }, locale);
export const emptyCartFixture = (locale: Locale = 'en') => pick<Cart>({ en: cartEmptyEn, ar: cartEmptyAr }, locale);
export const wishlistFixture = (locale: Locale = 'en') => pick<WishlistPage>({ en: wishlistEn, ar: wishlistAr }, locale);
export const compareFixture = (locale: Locale = 'en') => pick<CompareData>({ en: compareEn, ar: compareAr }, locale);
export const notificationsFixture = (locale: Locale = 'en') => pick<NotificationsPage>({ en: notificationsEn, ar: notificationsAr }, locale);
