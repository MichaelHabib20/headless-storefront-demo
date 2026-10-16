import type { Locale, ProductCard, ProductDetails, ProductOption } from '@/sdk';
import type { Translator } from '@/lib/i18n';
import { INTL_LOCALE, formatNumber } from '@/lib/numbers';
import type { QuantityLimits } from '../cart/quantity';

/**
 * Display helpers for the product page. Presentation only: which variant a value opens, its
 * state, the price, the stock text and the quantity limits all come from the API as they are.
 */

/** How an option is drawn. The API's hint may grow; anything unknown is drawn as buttons. */
export type OptionLook = 'buttons' | 'dropdown' | 'color' | 'image';

const LOOKS: ReadonlySet<string> = new Set<OptionLook>(['buttons', 'dropdown', 'color', 'image']);

export function optionLook(option: ProductOption): OptionLook {
  return LOOKS.has(option.display) ? (option.display as OptionLook) : 'buttons';
}

/** Stepper limits from the backend: `quantityStep` and `purchase.minQuantity` / `maxQuantity`. */
export function quantityLimits({ product, quantityStep }: Pick<ProductDetails, 'product' | 'quantityStep'>): QuantityLimits {
  return { step: quantityStep > 0 ? quantityStep : 1, min: product.purchase.minQuantity, max: product.purchase.maxQuantity };
}

/** The five-star scale ratings are given on. */
export const RATING_SCALE = 5;

/** A star rating (not money) with one decimal, in the shopper's digits: 4.1 → "4.1" in both languages. */
export function ratingText(average: number, locale: Locale): string {
  return formatNumber(Math.round(average * 10) / 10, locale);
}

/** How much of the stars to fill, as a CSS length. */
export function ratingFill(average: number): string {
  return `${Math.min(100, Math.max(0, (average / RATING_SCALE) * 100))}%`;
}

/** "Rated 4.1 out of 5" in the shopper's language and digits. */
export function ratingLabel(average: number, locale: Locale, t: Translator): string {
  return fillTemplate(t('productRating'), { rating: ratingText(average, locale), max: formatNumber(RATING_SCALE, locale) });
}

/** "23 reviews" / "1 review". */
export function reviewCountLabel(count: number, locale: Locale, t: Translator): string {
  return count === 1 ? t('productReviewCountOne') : fillTemplate(t('productReviewCount'), { count: formatNumber(count, locale) });
}

/** The date a review was written, e.g. "Sep 28, 2026" / "28 سبتمبر 2026". `timeZone` is for tests. */
export function reviewDate(iso: string, locale: Locale, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'ar' ? INTL_LOCALE.ar : 'en', { dateStyle: 'medium', timeZone }).format(date);
}

/** The video link is opened in a new tab; only web addresses are followed. */
export function safeVideoUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

/** Text of a product badge: the API's, or ours for the kinds that come without one. */
export function badgeText(badge: ProductCard['badges'][number], t: Translator): string | null {
  if (badge.text) return badge.text;
  if (badge.kind === 'preorder') return t('preorder');
  if (badge.kind === 'coming_soon') return t('comingSoonBadge');
  return null;
}

/** Fills `{name}` placeholders of a UI string from src/lib/messages. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
