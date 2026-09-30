import type { Locale } from '@/sdk';

/**
 * Numbers that are NOT money — counts, page numbers, quantities — in the shopper's digits
 * (Arabic uses Arabic-Indic digits). The only file allowed to format numbers
 * (`no-money-formatting` rule). Money is never formatted here: the backend sends it as text,
 * shown by <Money> / <Price> from @/money.
 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', { maximumFractionDigits: 3 }).format(value);
}
