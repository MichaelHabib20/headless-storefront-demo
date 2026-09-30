import type { CartItem, CartItemAvailability, Locale } from '@/sdk';
import { formatNumber } from '@/lib/numbers';

/**
 * Quantity stepper arithmetic (units, never money). The limits come from the backend:
 * `quantityStep` and `availability.minQuantity` / `maxQuantity`. The backend still
 * validates every change; this only keeps the buttons from offering impossible values.
 */
export interface QuantityLimits {
  step: number;
  min: number;
  max: number | null;
}

export function limitsFor(item: CartItem): QuantityLimits {
  return {
    step: item.quantityStep > 0 ? item.quantityStep : 1,
    min: item.availability.minQuantity,
    max: item.availability.maxQuantity,
  };
}

/** The quantity one step up, or null when the backend's maximum doesn't allow it. */
export function stepUp(quantity: number, { step, min, max }: QuantityLimits): number | null {
  const next = Math.max(roundToStep(quantity + step, step), min);
  if (max !== null && next > max) return null;
  return next;
}

/**
 * The quantity one step down, or null below the minimum (the shopper removes the line
 * instead). Above the maximum it goes straight to the maximum.
 */
export function stepDown(quantity: number, { step, min, max }: QuantityLimits): number | null {
  let next = roundToStep(quantity - step, step);
  if (max !== null && next > max) next = max;
  if (next < min) return null;
  return next;
}

/** Statuses a quantity change can resolve; other lines can only be removed. */
const QUANTITY_FIXABLE: ReadonlySet<CartItemAvailability['status']> = new Set(['available', 'exceeds_limit', 'below_minimum']);

export function canChangeQuantity(availability: CartItemAvailability): boolean {
  return QUANTITY_FIXABLE.has(availability.status);
}

export function formatQuantity(quantity: number, locale: Locale): string {
  return formatNumber(quantity, locale);
}

/** 0.1 + 0.2 must show as 0.3: keep as many decimals as the step has. */
function roundToStep(value: number, step: number): number {
  const factor = 10 ** (String(step).split('.')[1] ?? '').length;
  return Math.round(value * factor) / factor;
}
