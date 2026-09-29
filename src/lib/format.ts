import type { Locale, Price } from '@/sdk';

/**
 * Display formatting only. Amounts are computed by the backend (Price.amount,
 * compareAt, discountPercent) — never recompute them here.
 */
export function formatMoney(amount: number, currency: string | null, locale: Locale): string {
  const number = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (!currency) return number;
  return locale === 'ar' ? `${number} ${currencyLabel(currency, locale)}` : `${currencyLabel(currency, locale)} ${number}`;
}

export function formatPrice(price: Price, locale: Locale) {
  return {
    amount: formatMoney(price.amount, price.currency, locale),
    compareAt: price.compareAt !== null ? formatMoney(price.compareAt, price.currency, locale) : null,
    discount: price.discountPercent ? `-${price.discountPercent}%` : null,
  };
}

function currencyLabel(code: string, locale: Locale): string {
  if (locale === 'ar' && code.toUpperCase() === 'EGP') return 'ج.م';
  return code.toUpperCase();
}
