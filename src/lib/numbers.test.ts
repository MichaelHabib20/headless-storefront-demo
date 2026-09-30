import { describe, expect, it } from 'vitest';
import { formatNumber } from './numbers';

describe('formatNumber (counts and quantities, never money)', () => {
  it('uses the shopper digits', () => {
    expect(formatNumber(24, 'en')).toBe('24');
    expect(formatNumber(24, 'ar')).toBe('٢٤');
    expect(formatNumber(1500, 'en')).toBe('1,500');
  });

  it('keeps the decimals of weighed quantities', () => {
    expect(formatNumber(0.5, 'en')).toBe('0.5');
    expect(formatNumber(1.25, 'en')).toBe('1.25');
  });
});
