import { describe, expect, it } from 'vitest';
import { formatDate } from './dates';

describe('formatDate (display only)', () => {
  it('writes the date in the page language', () => {
    expect(formatDate('2026-09-28T09:30:00Z', 'en', { timeZone: 'UTC' })).toBe('September 28, 2026');
    expect(formatDate('2026-09-28T09:30:00Z', 'ar', { timeZone: 'UTC' })).toBe('28 سبتمبر 2026');
  });

  it('follows the time zone it is given', () => {
    expect(formatDate('2026-09-28T23:30:00Z', 'en', { timeZone: 'Africa/Cairo' })).toBe('September 29, 2026');
  });

  it('shows an unreadable value as it came instead of crashing', () => {
    expect(formatDate('soon', 'en')).toBe('soon');
  });
});
