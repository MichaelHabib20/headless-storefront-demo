import type { Banner, Locale, SectionLayout } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Rail, RailItem } from '../../ui/Rail';
import { ResponsiveImage } from '../../ui/ResponsiveImage';
import { TargetLink } from '../../ui/TargetLink';
import styles from './BannerLayouts.module.css';

export interface BannerLayoutProps {
  banners: Banner[];
  locale: Locale;
  label: string;
  priority?: boolean;
}

function BannerLink({ banner, locale, priority }: { banner: Banner; locale: Locale; priority?: boolean }) {
  return (
    <TargetLink target={banner.target} locale={locale} className={styles.banner}>
      <ResponsiveImage image={banner.image} priority={priority} className={styles.image} />
    </TargetLink>
  );
}

function Stack({ banners, locale, priority }: BannerLayoutProps) {
  return (
    <div className={styles.stack}>
      {banners.map((banner, i) => (
        <BannerLink key={banner.id || i} banner={banner} locale={locale} priority={priority && i === 0} />
      ))}
    </div>
  );
}

function Single({ banners, locale, priority }: BannerLayoutProps) {
  return banners[0] ? <BannerLink banner={banners[0]} locale={locale} priority={priority} /> : null;
}

function Grid({ banners, locale, priority }: BannerLayoutProps) {
  return (
    <div className={styles.grid} style={{ ['--columns' as string]: Math.min(banners.length, 3) }}>
      {banners.map((banner, i) => (
        <BannerLink key={banner.id || i} banner={banner} locale={locale} priority={priority && i === 0} />
      ))}
    </div>
  );
}

function Rows({ banners, locale, priority }: BannerLayoutProps) {
  return (
    <div className={styles.rows}>
      {banners.map((banner, i) => (
        <BannerLink key={banner.id || i} banner={banner} locale={locale} priority={priority && i === 0} />
      ))}
    </div>
  );
}

function Carousel({ banners, locale, label }: BannerLayoutProps) {
  const t = translator(locale);
  return (
    <Rail label={label} previousLabel={t('previous')} nextLabel={t('next')} perView={2}>
      {banners.map((banner, i) => (
        <RailItem key={banner.id || i}>
          <BannerLink banner={banner} locale={locale} />
        </RailItem>
      ))}
    </Rail>
  );
}

function None() {
  return null;
}

/**
 * How each backend layout name is drawn in this storefront. Adding a layout to the
 * contract means adding one entry here; unknown names fall back to the grid.
 */
export const bannerLayouts: Record<SectionLayout, (props: BannerLayoutProps) => React.ReactNode> = {
  products_only: None,
  single_banner: Single,
  wide_banner: Stack,
  banner_carousel: Carousel,
  banner_grid: Grid,
  banner_rows: Rows,
};
