import type { Locale } from '@/sdk';
import { INTL_LOCALE } from './numbers';

/**
 * Dates from the API (ISO date-time strings, e.g. `Order.placedAt`) as text in the page's language,
 * with the platform's date formatting (Arabic gets Arabic month names with Latin digits, see INTL_LOCALE). Dates are not
 * money: formatting them here is fine. Display only — never compute a rule from a date (e.g. "can
 * cancel within 24 hours"): such decisions come from the API.
 *
 * Time zone: dates are shown on the store's clock, never the server's or the browser's. The API
 * has no store time-zone setting, but every timestamp it sends carries the store's UTC offset
 * (`2026-10-17T01:10:11+03:00`, written in the backend's app time zone), so the date and time
 * written in the string are the store's. A timestamp in UTC (`…Z`) carries no store offset; it is
 * shown on FALLBACK_STORE_TIME_ZONE.
 */

/** Used only for timestamps that carry no store offset (`Z`). The API has no store time-zone field. */
export const FALLBACK_STORE_TIME_ZONE = 'Africa/Cairo';

const WITH_OFFSET = /T[\d:.]+([+-])(\d{2}):?(\d{2})$/;
const WITHOUT_ZONE = /T[\d:.]+$/;

/**
 * The instant to format and the zone to format it in so the text shows the store's clock.
 * `timeZone` forces a zone (tests). Null for an unreadable value.
 */
export function storeClock(iso: string, timeZone?: string): { date: Date; timeZone: string } | null {
  const value = iso.trim();
  // A date-time without a zone is read as the store's wall clock, not the server's local time.
  const date = new Date(WITHOUT_ZONE.test(value) ? `${value}Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  if (timeZone) return { date, timeZone };
  const offset = WITH_OFFSET.exec(value);
  if (offset) {
    const minutes = (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3]));
    return { date: new Date(date.getTime() + minutes * 60_000), timeZone: 'UTC' };
  }
  if (WITHOUT_ZONE.test(value) || !value.includes('T')) return { date, timeZone: 'UTC' };
  return { date, timeZone: FALLBACK_STORE_TIME_ZONE };
}

/** `iso` formatted with `options` on the store's clock; an unreadable value is shown as it came. */
export function formatStoreTime(iso: string, intlLocale: string, options: Intl.DateTimeFormatOptions, timeZone?: string): string {
  const clock = storeClock(iso, timeZone);
  if (!clock) return iso;
  return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: clock.timeZone }).format(clock.date);
}

/** "September 28, 2026" / "28 سبتمبر 2026". An unreadable value is shown as it came. */
export function formatDate(iso: string, locale: Locale, { timeZone }: { timeZone?: string } = {}): string {
  return formatStoreTime(iso, INTL_LOCALE[locale], { day: 'numeric', month: 'long', year: 'numeric' }, timeZone);
}
