import { describe, expect, it } from 'vitest';
import type { CartItemAvailability } from '@/sdk';
import { cartFixture } from '@/test/fixtures';
import { canChangeQuantity, formatQuantity, limitsFor, stepDown, stepUp } from './quantity';

const limits = (min: number, max: number | null, step = 1) => ({ step, min, max });
const availability = (status: CartItemAvailability['status']): CartItemAvailability => ({ status, message: null, minQuantity: 1, maxQuantity: 5 });

describe('cart quantity stepper', () => {
  it('reads the limits the backend sent for the line', () => {
    const item = cartFixture('en').items[0];
    expect(limitsFor(item)).toEqual({ step: 1, min: 1, max: 5 });
    expect(limitsFor({ ...item, quantityStep: 0 }).step).toBe(1);
  });

  it('steps up until the maximum', () => {
    expect(stepUp(2, limits(1, 5))).toBe(3);
    expect(stepUp(5, limits(1, 5))).toBeNull();
    expect(stepUp(40, limits(1, null))).toBe(41);
  });

  it('steps down until the minimum', () => {
    expect(stepDown(2, limits(1, 5))).toBe(1);
    expect(stepDown(1, limits(1, 5))).toBeNull();
    expect(stepDown(3, limits(2, 5))).toBe(2);
  });

  it('brings lines outside the limits back inside them', () => {
    expect(stepDown(8, limits(1, 5))).toBe(5);
    expect(stepUp(1, limits(3, 10))).toBe(3);
  });

  it('keeps decimal steps exact', () => {
    expect(stepUp(0.2, limits(0.1, null, 0.1))).toBe(0.3);
    expect(stepDown(1.5, limits(0.5, null, 0.5))).toBe(1);
  });

  it('lets quantity fix only the statuses a quantity can fix', () => {
    expect(canChangeQuantity(availability('available'))).toBe(true);
    expect(canChangeQuantity(availability('exceeds_limit'))).toBe(true);
    expect(canChangeQuantity(availability('below_minimum'))).toBe(true);
    expect(canChangeQuantity(availability('out_of_stock'))).toBe(false);
    expect(canChangeQuantity(availability('unavailable'))).toBe(false);
  });

  it('formats quantities per language', () => {
    expect(formatQuantity(2, 'en')).toBe('2');
    expect(formatQuantity(2, 'ar')).toBe('2');
  });
});
