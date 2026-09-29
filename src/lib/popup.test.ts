import { describe, expect, it } from 'vitest';
import type { Popup } from '@/sdk';
import { pickPopup, remember, shouldShow, type PopupMemory } from './popup';

const popup = (id: number, frequency: Popup['frequency']): Popup => ({
  id,
  frequency,
  title: null,
  description: null,
  target: null,
  image: { mobile: 'm.jpg', desktop: 'd.jpg', alt: null },
});

const empty: PopupMemory = { shownAt: {}, sessionShown: [] };
const now = new Date('2026-09-29T12:00:00Z');

describe('popup frequency', () => {
  it('always shows "always"', () => {
    const memory = remember(popup(1, 'always'), empty, now);
    expect(shouldShow(popup(1, 'always'), memory, now)).toBe(true);
  });

  it('shows "once_per_session" once per session', () => {
    const p = popup(2, 'once_per_session');
    expect(shouldShow(p, empty, now)).toBe(true);
    expect(shouldShow(p, remember(p, empty, now), now)).toBe(false);
  });

  it('shows "once_per_day" again after 24 hours', () => {
    const p = popup(3, 'once_per_day');
    const memory = remember(p, empty, now);
    expect(shouldShow(p, memory, new Date('2026-09-30T11:59:00Z'))).toBe(false);
    expect(shouldShow(p, memory, new Date('2026-09-30T12:00:00Z'))).toBe(true);
  });

  it('skips frequencies it does not know', () => {
    expect(shouldShow({ ...popup(4, 'always'), frequency: 'hourly' as Popup['frequency'] }, empty, now)).toBe(false);
  });

  it('picks the first popup that may show', () => {
    const seen = remember(popup(5, 'once_per_session'), empty, now);
    expect(pickPopup([popup(5, 'once_per_session'), popup(6, 'always')], seen, now)?.id).toBe(6);
    expect(pickPopup([], empty, now)).toBeNull();
  });
});
