import { describe, expect, it } from 'vitest';
import { badgeText, countLabel, formatCount, withCount } from './labels';

const forms = { none: 'Cart', one: 'Cart, 1 item', other: 'Cart, {count} items' };

describe('shopper labels', () => {
  it('formats counts per locale', () => {
    expect(formatCount(24, 'en')).toBe('24');
    expect(formatCount(24, 'ar')).toBe('٢٤');
    expect(withCount('In cart ({count})', 2, 'en')).toBe('In cart (2)');
    expect(withCount('في السلة ({count})', 2, 'ar')).toBe('في السلة (٢)');
  });

  it('builds accessible names with the count', () => {
    expect(countLabel('en', 0, forms)).toBe('Cart');
    expect(countLabel('en', undefined, forms)).toBe('Cart');
    expect(countLabel('en', null, forms)).toBe('Cart');
    expect(countLabel('en', 1, forms)).toBe('Cart, 1 item');
    expect(countLabel('en', 2, forms)).toBe('Cart, 2 items');
    expect(countLabel('en', 1500, forms)).toBe('Cart, 1,500 items');
  });

  it('caps badge text but keeps small numbers as they are', () => {
    expect(badgeText(7, 'en')).toBe('7');
    expect(badgeText(99, 'en')).toBe('99');
    expect(badgeText(100, 'en')).toBe('99+');
    expect(badgeText(250, 'ar')).toBe('٩٩+');
  });
});
