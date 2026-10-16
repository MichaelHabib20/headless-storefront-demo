import type { Locale } from '@/sdk';
import { INTL_LOCALE } from './numbers';

/**
 * Dates from the API (ISO date-time strings, e.g. `Order.placedAt`) as text in the page's language,
 * with the platform's date formatting (Arabic gets Arabic month names with Latin digits, see INTL_LOCALE). Dates are not
 * money: formatting them here is fine. Display only — never compute a rule from a date (e.g. "can
 * cancel within 24 hours"): such decisions come from the API.
 */

/** "September 28, 2026" / "28 سبتمبر 2026". An unreadable value is shown as it came. */
export function formatDate(iso: string, locale: Locale, { timeZone }: { timeZone?: string } = {}): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
}
