/**
 * Product page answers used by component tests, generated from the contract-checked mock
 * (`node scripts/build-product-fixtures.mjs`; `npm run contract:check` validates them).
 */
import type { Locale, ProductDetails, ProductRecommendations, ProductReviewsPage } from '@/sdk';
import discountedAr from './fixtures/v3/product-discounted.ar.json';
import discountedEn from './fixtures/v3/product-discounted.en.json';
import galleryAr from './fixtures/v3/product-gallery.ar.json';
import galleryEn from './fixtures/v3/product-gallery.en.json';
import outOfStockAr from './fixtures/v3/product-out-of-stock.ar.json';
import outOfStockEn from './fixtures/v3/product-out-of-stock.en.json';
import recommendationsAr from './fixtures/v3/product-recommendations.ar.json';
import recommendationsEn from './fixtures/v3/product-recommendations.en.json';
import reviewsDisabledAr from './fixtures/v3/product-reviews-disabled.ar.json';
import reviewsDisabledEn from './fixtures/v3/product-reviews-disabled.en.json';
import reviewsAr from './fixtures/v3/product-reviews.ar.json';
import reviewsEn from './fixtures/v3/product-reviews.en.json';
import productAr from './fixtures/v3/product.ar.json';
import productEn from './fixtures/v3/product.en.json';

type ByLocale = Record<Locale, { data: unknown }>;
const pick = <T,>(files: ByLocale, locale: Locale): T => structuredClone(files[locale].data) as T;

/** J&J Baby Cologne 100 ml Dream: size buttons + scent swatches (one out of stock), rating, notices. */
export const productFixture = (locale: Locale = 'en') => pick<ProductDetails>({ en: productEn, ar: productAr }, locale);
/** The Morning Dew variant: out of stock, `notifyMe`, cannot be added to the cart. */
export const outOfStockProductFixture = (locale: Locale = 'en') => pick<ProductDetails>({ en: outOfStockEn, ar: outOfStockAr }, locale);
/** Bedtime Bath 500 ml: discounted price, size as a dropdown, an info notice. */
export const discountedProductFixture = (locale: Locale = 'en') => pick<ProductDetails>({ en: discountedEn, ar: discountedAr }, locale);
/** Bedtime Bath 125 ml: four images and a video. */
export const galleryProductFixture = (locale: Locale = 'en') => pick<ProductDetails>({ en: galleryEn, ar: galleryAr }, locale);
/** Related row + bought-together row with a total. */
export const recommendationsFixture = (locale: Locale = 'en') => pick<ProductRecommendations>({ en: recommendationsEn, ar: recommendationsAr }, locale);
/** Page 1 of 5 (perPage 5, 23 reviews) with the summary. */
export const reviewsFixture = (locale: Locale = 'en') => pick<ProductReviewsPage>({ en: reviewsEn, ar: reviewsAr }, locale);
/** The store switched reviews off. */
export const reviewsDisabledFixture = (locale: Locale = 'en') => pick<ProductReviewsPage>({ en: reviewsDisabledEn, ar: reviewsDisabledAr }, locale);
