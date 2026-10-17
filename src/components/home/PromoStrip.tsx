import type { Locale, PromoBanner } from '@/sdk';
import { translator } from '@/lib/i18n';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { TargetLink } from '../ui/TargetLink';
import styles from './PromoStrip.module.css';

/**
 * The image is the link's only content, so its alt text is the link's name: the merchant's alt text,
 * else the banner's title (the ad's name, e.g. "Top AD", the old storefront's fallback), else the
 * title of the page it opens (filled in by the page, withBannerNames), else the slot's name
 * ("top-ad" → "Top ad"), else "Banner": never an unnamed link.
 */
export function promoName(banner: PromoBanner, locale: Locale): string {
  const own = banner.image.alt?.trim() || banner.title?.trim();
  if (own) return own;
  const words = banner.placement.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : translator(locale)('bannerLabel');
}

export function PromoStrip({ banner, locale, priority }: { banner: PromoBanner | null; locale: Locale; priority?: boolean }) {
  if (!banner) return null;
  return (
    <div className={`container ${styles.strip}`} data-testid={`promo-${banner.placement}`}>
      <TargetLink target={banner.target} locale={locale} className={styles.link}>
        <ResponsiveImage image={{ ...banner.image, alt: promoName(banner, locale) }} priority={priority} className={styles.image} />
      </TargetLink>
    </div>
  );
}
