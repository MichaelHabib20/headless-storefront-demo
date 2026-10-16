import { describe, expect, it } from 'vitest';
import { formatNumber } from './numbers';

describe('formatNumber (counts and quantities, never money)', () => {
  it('uses Latin digits in both languages, like the money texts and the old storefront', () => {
    expect(formatNumber(24, 'en')).toBe('24');
    expect(formatNumber(24, 'ar')).toBe('24');
    expect(formatNumber(1500, 'en')).toBe('1,500');
    expect(formatNumber(2217, 'ar')).toBe('2,217');
    expect(formatNumber(4.1, 'ar')).toBe('4.1');
  });

  it('keeps the decimals of weighed quantities', () => {
    expect(formatNumber(0.5, 'en')).toBe('0.5');
    expect(formatNumber(1.25, 'en')).toBe('1.25');
  });
});
