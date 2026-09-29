import type { Locale, Tile } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Rail, RailItem } from '../ui/Rail';
import { SectionHeading } from '../ui/SectionHeading';
import { TargetLink } from '../ui/TargetLink';
import styles from './BrandRail.module.css';

export function BrandRail({ brands, locale }: { brands: Tile[]; locale: Locale }) {
  if (!brands.length) return null;
  const t = translator(locale);

  return (
    <section className={`container ${styles.section}`} aria-labelledby="featured-brands">
      <SectionHeading id="featured-brands" title={t('brands')} locale={locale} viewAllLabel={t('viewAll')} />
      <Rail label={t('brands')} previousLabel={t('previous')} nextLabel={t('next')} perView={6}>
        {brands.map((brand) => (
          <RailItem key={brand.id}>
            <TargetLink target={brand.target} locale={locale} className={styles.brand} aria-label={brand.name}>
              {brand.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                <img src={brand.image.url} alt="" loading="lazy" decoding="async" className={styles.logo} />
              ) : (
                <span className={styles.name}>{brand.name}</span>
              )}
            </TargetLink>
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
