import type { Locale } from '@/sdk';
import { formatNumber } from '@/lib/numbers';

/** A count as the page shows numbers (Arabic uses Arabic-Indic digits). */
export function formatCount(count: number, locale: Locale): string {
  return formatNumber(count, locale);
}

/** Fills `{count}` in a translated template. */
export function withCount(template: string, count: number, locale: Locale): string {
  return template.replace('{count}', formatCount(count, locale));
}

export interface CountForms {
  /** No count (zero or unknown): the plain label, e.g. "Cart". */
  none: string;
  /** Exactly one, e.g. "Cart, 1 item". */
  one: string;
  /** Any other count, with `{count}`, e.g. "Cart, {count} items". */
  other: string;
}

/** Accessible name for a header icon with a badge: "Cart", "Cart, 1 item", "Cart, 3 items". */
export function countLabel(locale: Locale, count: number | null | undefined, forms: CountForms): string {
  if (!count) return forms.none;
  return withCount(count === 1 ? forms.one : forms.other, count, locale);
}

/** Text inside a badge. Large counts are capped for space; the accessible name keeps the real number. */
export function badgeText(count: number, locale: Locale): string {
  return count > 99 ? `${formatCount(99, locale)}+` : formatCount(count, locale);
}
