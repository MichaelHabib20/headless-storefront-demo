import { describe, expect, it } from 'vitest';
import { fill, formatCount, formatNotificationDate, notificationsPageHref, pageFromQuery } from './helpers';

const now = new Date('2026-09-29T10:00:00Z');
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatNotificationDate', () => {
  const en = (iso: string) => formatNotificationDate(iso, 'en', { now, timeZone: 'UTC' });
  const ar = (iso: string) => formatNotificationDate(iso, 'ar', { now, timeZone: 'UTC' });

  it('says how long ago in English', () => {
    expect(en(ago(0)).label).toBe('now');
    expect(en(ago(30)).label).toBe('now');
    expect(en(ago(5 * MINUTE)).label).toBe('5 minutes ago');
    expect(en(ago(3 * HOUR)).label).toBe('3 hours ago');
    expect(en(ago(DAY)).label).toBe('yesterday');
    expect(en(ago(3 * DAY)).label).toBe('3 days ago');
  });

  it('shows the date once it is a week old', () => {
    expect(en(ago(10 * DAY)).label).toBe('Sep 19, 2026');
    expect(ar(ago(10 * DAY)).label).toBe('19 سبتمبر 2026');
  });

  it('says how long ago in Arabic with Latin digits', () => {
    expect(ar(ago(0)).label).toBe('الآن');
    expect(ar(ago(DAY)).label).toBe('أمس');
    expect(ar(ago(3 * DAY)).label).toContain('3');
    expect(ar(ago(5 * MINUTE)).label).toContain('5');
  });

  it('gives the full date and time for the tooltip', () => {
    const { absolute } = en('2026-09-19T10:00:00Z');
    expect(absolute).toMatch(/September 19, 2026/);
    expect(absolute).toMatch(/10:00/);
    expect(ar('2026-09-19T10:00:00Z').absolute).toMatch(/19 سبتمبر 2026/);
  });

  it('treats small clock skew as now and far-future dates as a date', () => {
    expect(en(new Date(now.getTime() + 20_000).toISOString()).label).toBe('now');
    expect(en('2026-10-05T10:00:00Z').label).toBe('Oct 5, 2026');
  });

  it('shows an unparseable value as it came', () => {
    expect(en('not a date')).toEqual({ label: 'not a date', absolute: 'not a date' });
  });
});

describe('formatCount', () => {
  it('uses the digits of the language', () => {
    expect(formatCount(24, 'en')).toBe('24');
    expect(formatCount(24, 'ar')).toBe('24');
  });
});

describe('fill', () => {
  it('replaces placeholders and keeps unknown ones', () => {
    expect(fill('Page {page} of {total}', { page: '1', total: '3' })).toBe('Page 1 of 3');
    expect(fill('{count} unread {x}', { count: '2' })).toBe('2 unread {x}');
  });
});

describe('pageFromQuery', () => {
  it.each([
    [undefined, 1],
    ['2', 2],
    ['0', 1],
    ['-1', 1],
    ['2.5', 1],
    ['abc', 1],
    [['3', '4'], 3],
  ] as const)('%j → %i', (value, expected) => {
    expect(pageFromQuery(value as string | string[] | undefined)).toBe(expected);
  });
});

describe('notificationsPageHref', () => {
  it('keeps page 1 canonical and adds ?page= after it', () => {
    expect(notificationsPageHref('en', 1)).toBe('/en/notifications');
    expect(notificationsPageHref('ar', 2)).toBe('/ar/notifications?page=2');
  });
});
