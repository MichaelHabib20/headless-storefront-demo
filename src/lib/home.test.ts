import { describe, expect, it } from 'vitest';
import { homeFixture } from '@/test/fixtures';
import { knownDesign, normalizeLayout, promoFor } from './home';

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

  it('uses a design only when the storefront draws it', () => {
    const drawn = { banner_grid: 1, hero_split: 1 };
    expect(knownDesign('hero_split', drawn)).toBe('hero_split');
    expect(knownDesign('banner_grid', drawn)).toBe('banner_grid');
    expect(knownDesign('not_built_here', drawn)).toBeNull();
    expect(knownDesign('constructor', drawn)).toBeNull();
    expect(knownDesign(null, drawn)).toBeNull();
    expect(knownDesign(undefined, drawn)).toBeNull();
    expect(knownDesign('', drawn)).toBeNull();
  });
});
