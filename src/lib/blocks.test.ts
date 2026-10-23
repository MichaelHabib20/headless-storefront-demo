import { describe, expect, it } from 'vitest';
import type { SectionBlockImage, Section } from '@/sdk';
import { homeBlocksFixture, homeFixture } from '@/test/fixtures';
import { blockImage, sectionBlocks } from './blocks';

const image = (media: Partial<SectionBlockImage['media']>): SectionBlockImage => ({
  type: 'image',
  media: { desktop: 'd.jpg', mobile: null, desktop_ar: null, mobile_ar: null, ...media },
  alt: null,
  target: null,
});

describe('sectionBlocks', () => {
  it('is null for sections without blocks: missing, null or an empty tree', () => {
    const section = homeFixture('en').sections[0];
    expect(sectionBlocks(section)).toBeNull();
    expect(sectionBlocks({ ...section, blocks: null })).toBeNull();
    expect(sectionBlocks({ ...section, blocks: { version: 1, blocks: [] } })).toBeNull();
    expect(sectionBlocks({ ...section, blocks: {} } as unknown as Section)).toBeNull();
  });

  it('returns the nodes of a section that has some', () => {
    const section = homeBlocksFixture('en').sections[0];
    expect(sectionBlocks(section)).toBe(section.blocks!.blocks);
  });
});

describe('blockImage', () => {
  it('English: mobile artwork, else the desktop one', () => {
    expect(blockImage(image({ mobile: 'm.jpg' }), 'en', 'A')).toEqual({ desktop: 'd.jpg', mobile: 'm.jpg', alt: 'A' });
    expect(blockImage(image({}), 'en', '')).toEqual({ desktop: 'd.jpg', mobile: 'd.jpg', alt: '' });
    // Arabic artwork is never shown on English pages
    expect(blockImage(image({ desktop_ar: 'da.jpg', mobile_ar: 'ma.jpg' }), 'en', '')).toMatchObject({ desktop: 'd.jpg', mobile: 'd.jpg' });
  });

  it('Arabic: the Arabic artwork first, then the English one', () => {
    expect(blockImage(image({ mobile: 'm.jpg', desktop_ar: 'da.jpg', mobile_ar: 'ma.jpg' }), 'ar', 'ب')).toEqual({ desktop: 'da.jpg', mobile: 'ma.jpg', alt: 'ب' });
    // only an Arabic desktop picture: it beats the English phone picture
    expect(blockImage(image({ mobile: 'm.jpg', desktop_ar: 'da.jpg' }), 'ar', '')).toMatchObject({ desktop: 'da.jpg', mobile: 'da.jpg' });
    // only an Arabic phone picture
    expect(blockImage(image({ mobile: 'm.jpg', mobile_ar: 'ma.jpg' }), 'ar', '')).toMatchObject({ desktop: 'd.jpg', mobile: 'ma.jpg' });
    // no Arabic artwork: as in English
    expect(blockImage(image({ mobile: 'm.jpg' }), 'ar', '')).toMatchObject({ desktop: 'd.jpg', mobile: 'm.jpg' });
  });
});
