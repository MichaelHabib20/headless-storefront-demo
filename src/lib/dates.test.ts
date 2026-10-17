import { describe, expect, it } from 'vitest';
import { FALLBACK_STORE_TIME_ZONE, formatDate, formatStoreTime, storeClock } from './dates';

describe('formatDate (display only)', () => {
  it('writes the date in the page language', () => {
    expect(formatDate('2026-09-28T09:30:00Z', 'en', { timeZone: 'UTC' })).toBe('September 28, 2026');
    expect(formatDate('2026-09-28T09:30:00Z', 'ar', { timeZone: 'UTC' })).toBe('28 سبتمبر 2026');
  });

  it('follows the time zone it is given', () => {
    expect(formatDate('2026-09-28T23:30:00Z', 'en', { timeZone: 'Africa/Cairo' })).toBe('September 29, 2026');
  });

  it("shows the store's date just after midnight, not UTC's (order placed 01:10 Cairo time)", () => {
    expect(formatDate('2026-10-17T01:10:11+03:00', 'en')).toBe('October 17, 2026');
    expect(formatDate('2026-10-17T01:10:11+03:00', 'ar')).toBe('17 أكتوبر 2026');
    expect(formatDate('2026-10-16T23:59:59+03:00', 'en')).toBe('October 16, 2026');
    expect(formatDate('2026-10-17T00:00:00+0300', 'en')).toBe('October 17, 2026');
    expect(formatDate('2026-10-16T23:30:00-05:00', 'en')).toBe('October 16, 2026');
    expect(formatDate('2026-10-17T00:15:00+05:30', 'en')).toBe('October 17, 2026');
  });

  it('does not depend on the server time zone', () => {
    const before = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(formatDate('2026-10-17T01:10:11+03:00', 'en')).toBe('October 17, 2026');
        expect(formatDate('2026-10-17T01:10:11', 'en')).toBe('October 17, 2026');
        expect(formatStoreTime('2026-10-17T01:10:11+03:00', 'en', { timeStyle: 'short' })).toMatch(/^1:10\sAM$/u);
      }
    } finally {
      process.env.TZ = before;
    }
  });

  it(`shows a UTC timestamp on ${FALLBACK_STORE_TIME_ZONE} (no store offset in it)`, () => {
    expect(formatDate('2026-10-16T22:10:11Z', 'en')).toBe('October 17, 2026');
    expect(storeClock('2026-10-16T22:10:11.000Z')?.timeZone).toBe(FALLBACK_STORE_TIME_ZONE);
  });

  it('shows an unreadable value as it came instead of crashing', () => {
    expect(formatDate('soon', 'en')).toBe('soon');
  });
});
