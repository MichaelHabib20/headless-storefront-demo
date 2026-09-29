import type { Locale } from '@/sdk';
import { routes } from '@/lib/routing';

/**
 * Display helpers for the notifications page. Everything here is presentation only:
 * read state, unread counts and pagination come from the API as they are.
 */

/** Server actions the page hands to the components (see src/app/[locale]/notifications/actions.ts). */
export type MarkReadAction = (locale: Locale, notificationId: number) => Promise<void>;
export type MarkAllReadAction = (locale: Locale) => Promise<void>;
/** A MarkReadAction already bound to one notification (form action / on-open callback). */
export type BoundAction = () => Promise<void>;

const INTL_LOCALE: Record<Locale, string> = { en: 'en', ar: 'ar-EG' };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export interface NotificationDate {
  /** Short text for the list: "now", "5 minutes ago", "yesterday", or a date after a week. */
  label: string;
  /** Full date and time, for the `title` tooltip. */
  absolute: string;
}

/**
 * How long ago a notification arrived, in the shopper's language. `now` and `timeZone`
 * are parameters so the output is testable; the page passes the request time.
 */
export function formatNotificationDate(
  iso: string,
  locale: Locale,
  { now = new Date(), timeZone }: { now?: Date; timeZone?: string } = {},
): NotificationDate {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { label: iso, absolute: iso };

  const intl = INTL_LOCALE[locale];
  const absolute = new Intl.DateTimeFormat(intl, { dateStyle: 'long', timeStyle: 'short', timeZone }).format(date);
  const shortDate = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(date);

  // Seconds since it arrived; a slightly-future timestamp (clock skew) counts as "now".
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (date.getTime() - now.getTime() > MINUTE * 1000) return { label: shortDate, absolute };

  const relative = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
  let label: string;
  if (seconds < MINUTE) label = relative.format(0, 'second');
  else if (seconds < HOUR) label = relative.format(-Math.floor(seconds / MINUTE), 'minute');
  else if (seconds < DAY) label = relative.format(-Math.floor(seconds / HOUR), 'hour');
  else if (seconds < WEEK) label = relative.format(-Math.floor(seconds / DAY), 'day');
  else label = shortDate;
  return { label, absolute };
}

/** A count from the API (e.g. `unreadCount`) in the shopper's digits. */
export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** Fills `{name}` placeholders of a UI string from src/lib/messages. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

/** `?page=` from the URL: a positive integer, otherwise 1. */
export function pageFromQuery(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Link to a page of the notifications list (page 1 has no query, so it stays canonical). */
export function notificationsPageHref(locale: Locale, page: number): string {
  const base = routes.notifications(locale);
  return page > 1 ? `${base}?page=${page}` : base;
}
