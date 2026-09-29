import { describe, expect, it } from 'vitest';
import { homeFixture } from '@/test/fixtures';
import { normalizeLayout, promoFor } from './home';

describe('home helpers', () => {
  it('finds promo strips by placement in both languages', () => {
    expect(promoFor(homeFixture('en'), 'top-ad')?.placement).toBe('top-ad');
    expect(promoFor(homeFixture('ar'), 'top-ad')?.placement).toBe('top-ad');
    expect(promoFor(homeFixture('en'), 'nowhere')).toBeNull();
  });

  it('draws layouts added later as a grid', () => {
    expect(normalizeLayout('banner_rows')).toBe('banner_rows');
    expect(normalizeLayout('hero_video')).toBe('banner_grid');
  });
});
