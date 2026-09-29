import type { Locale, PromoBanner } from '@/sdk';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { TargetLink } from '../ui/TargetLink';
import styles from './PromoStrip.module.css';

export function PromoStrip({ banner, locale, priority }: { banner: PromoBanner | null; locale: Locale; priority?: boolean }) {
  if (!banner) return null;
  return (
    <div className={`container ${styles.strip}`} data-testid={`promo-${banner.placement}`}>
      <TargetLink target={banner.target} locale={locale} className={styles.link}>
        <ResponsiveImage image={banner.image} priority={priority} className={styles.image} />
      </TargetLink>
    </div>
  );
}
