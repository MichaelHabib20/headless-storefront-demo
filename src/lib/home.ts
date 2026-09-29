import type { Home, PromoBanner, SectionLayout } from '@/sdk';

/** Where this storefront puts the merchant's named promo strips. */
export const PROMO_PLACEMENTS = { top: 'top-ad', bottom: 'bottom-ad' } as const;

export function promoFor(home: Home, placement: string): PromoBanner | null {
  return home.promoBanners.find((banner) => banner.placement === placement) ?? null;
}

const KNOWN_LAYOUTS: readonly SectionLayout[] = [
  'products_only',
  'single_banner',
  'banner_carousel',
  'wide_banner',
  'banner_grid',
  'banner_rows',
];

/** Layouts added to the contract later render as a grid instead of disappearing. */
export function normalizeLayout(layout: string): SectionLayout {
  return (KNOWN_LAYOUTS as readonly string[]).includes(layout) ? (layout as SectionLayout) : 'banner_grid';
}
