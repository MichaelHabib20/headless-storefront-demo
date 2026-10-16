import type { Locale } from '@/sdk';

/**
 * The `Intl` locale of each page language, for numbers and dates that are not money. Arabic
 * keeps Arabic words (month names, "قبل 3 أيام") with Latin digits, like the old storefront and
 * like the backend's money texts ("230 جنية"), so a page never mixes ٢ and 2.
 */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-EG', ar: 'ar-EG-u-nu-latn' };

/**
 * Numbers that are NOT money — counts, page numbers, quantities — in the page's language
 * (Latin digits in Arabic too, see INTL_LOCALE). The only file allowed to format numbers
 * (`no-money-formatting` rule). Money is never formatted here: the backend sends it as text,
 * shown by <Money> / <Price> from @/money.
 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 3 }).format(value);
}
