import { describe, expect, it } from 'vitest';
import type { ProductOption } from '@/sdk';
import { translator } from '@/lib/i18n';
import { productFixture } from '@/test/product-fixtures';
import { badgeText, fillTemplate, optionLook, quantityLimits, ratingFill, ratingLabel, ratingText, reviewCountLabel, reviewDate, safeVideoUrl } from './details';

const option = (look: string) => ({ id: 1, name: 'Size', display: look, values: [] }) as unknown as ProductOption;

describe('product page helpers', () => {
  it('draws known option hints as asked and anything new as buttons', () => {
    for (const look of ['buttons', 'dropdown', 'color', 'image'] as const) expect(optionLook(option(look))).toBe(look);
    expect(optionLook(option('swatch_3d'))).toBe('buttons');
  });

  it('takes the stepper limits from the backend', () => {
    const details = productFixture('en');
    expect(quantityLimits(details)).toEqual({ step: 1, min: 1, max: 5 });

    details.quantityStep = 0.5;
    details.product.purchase = { canAddToCart: true, minQuantity: 2, maxQuantity: null };
    expect(quantityLimits(details)).toEqual({ step: 0.5, min: 2, max: null });

    details.quantityStep = 0; // never a step of 0: one unit at a time
    expect(quantityLimits(details).step).toBe(1);
  });

  it('shows a rating with one decimal in the shopper digits, and fills the stars', () => {
    expect(ratingText(4.1, 'en')).toBe('4.1');
    expect(ratingText(4.13, 'en')).toBe('4.1');
    expect(ratingText(5, 'en')).toBe('5');
    expect(ratingText(4.1, 'ar')).toBe('4.1');
    expect(ratingFill(4)).toBe('80%');
    expect(ratingFill(7)).toBe('100%');
    expect(ratingLabel(4.1, 'en', translator('en'))).toBe('Rated 4.1 out of 5');
    expect(ratingLabel(4.1, 'ar', translator('ar'))).toBe('التقييم 4.1 من 5');
  });

  it('names review counts', () => {
    expect(reviewCountLabel(1, 'en', translator('en'))).toBe('1 review');
    expect(reviewCountLabel(23, 'en', translator('en'))).toBe('23 reviews');
    expect(reviewCountLabel(23, 'ar', translator('ar'))).toBe('23 تقييم');
  });

  it('writes review dates in the shopper language, and keeps unreadable dates as they are', () => {
    expect(reviewDate('2026-09-28T10:00:00Z', 'en', 'UTC')).toBe('Sep 28, 2026');
    expect(reviewDate('2026-09-28T10:00:00Z', 'ar', 'UTC')).toContain('2026');
    expect(reviewDate('yesterday', 'en')).toBe('yesterday');
  });

  it('follows only web addresses for the video', () => {
    expect(safeVideoUrl('https://www.youtube.com/watch?v=x')).toBe('https://www.youtube.com/watch?v=x');
    expect(safeVideoUrl('javascript:alert(1)')).toBeNull();
    expect(safeVideoUrl('/relative.mp4')).toBeNull();
  });

  it('labels badges: the API text first, ours for kinds without one', () => {
    const t = translator('en');
    expect(badgeText({ kind: 'promotion', text: 'Limited offer', color: null }, t)).toBe('Limited offer');
    expect(badgeText({ kind: 'coming_soon', text: null, color: null }, t)).toBe('Coming soon');
    expect(badgeText({ kind: 'preorder', text: null, color: null }, t)).toBe('Pre-order');
    expect(badgeText({ kind: 'label', text: null, color: null }, t)).toBeNull();
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(fillTemplate('Image {n} of {total}', { n: '2', total: '4' })).toBe('Image 2 of 4');
    expect(fillTemplate('{x} left', {})).toBe('{x} left');
  });
});
