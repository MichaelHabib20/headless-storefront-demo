import { describe, expect, it } from 'vitest';
import { formatMoney, formatPrice } from './format';

describe('formatPrice', () => {
  it('shows backend amounts as they are', () => {
    expect(formatPrice({ currency: 'EGP', amount: 150, compareAt: 200, discountPercent: 25 }, 'en')).toEqual({
      amount: 'EGP 150',
      compareAt: 'EGP 200',
      discount: '-25%',
    });
  });

  it('has no compare-at or discount for full price', () => {
    expect(formatPrice({ currency: 'EGP', amount: 18, compareAt: null, discountPercent: null }, 'en')).toEqual({
      amount: 'EGP 18',
      compareAt: null,
      discount: null,
    });
  });

  it('keeps two decimals when the amount has cents', () => {
    expect(formatMoney(18.5, 'EGP', 'en')).toBe('EGP 18.50');
  });

  it('uses Arabic digits and currency in Arabic', () => {
    expect(formatMoney(150, 'EGP', 'ar')).toBe('١٥٠ ج.م');
  });

  it('works without a currency', () => {
    expect(formatMoney(10, null, 'en')).toBe('10');
  });
});
