import type { SectionBlockImage, Locale, ResponsiveImage, Section, SectionBlock } from '@/sdk';

/**
 * The section's blocks to draw, or null: draw the section as before (banners + products).
 * Null, missing and empty trees all mean "no blocks".
 */
export function sectionBlocks(section: Section): SectionBlock[] | null {
  const blocks = section.blocks?.blocks;
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : null;
}

/**
 * The image block's artwork for this language as a `ResponsiveImage` (mobile + desktop, chosen by the
 * browser). Arabic pages prefer the Arabic artwork: an Arabic desktop picture beats an English phone
 * picture (wrong-language text in an image is worse than a wider crop). Missing variants fall back
 * to the desktop one.
 */
export function blockImage(block: SectionBlockImage, locale: Locale, alt: string): ResponsiveImage {
  const { desktop, mobile, desktop_ar: desktopAr, mobile_ar: mobileAr } = block.media;
  if (locale === 'ar' && (desktopAr || mobileAr)) {
    return { desktop: desktopAr || desktop, mobile: mobileAr || desktopAr || mobile || desktop, alt };
  }
  return { desktop, mobile: mobile || desktop, alt };
}
