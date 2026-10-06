import Link from 'next/link';
import type { Home, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Rail, RailItem } from '../ui/Rail';
import { SectionHeading } from '../ui/SectionHeading';
import { TargetLink } from '../ui/TargetLink';
import styles from './BrandRail.module.css';

/**
 * phase B: the home vendors block (`Home.featuredVendors`, absent when the store shows none): the
 * backend's title and sellers, each opening its products; "all vendors" opens our vendors page.
 */
export function VendorRail({ block, locale }: { block: Home['featuredVendors']; locale: Locale }) {
  if (!block || !block.items.length) return null;
  const t = translator(locale);

  return (
    <section className={`container ${styles.section}`} aria-labelledby="featured-vendors" data-testid="home-vendors">
      <SectionHeading id="featured-vendors" title={block.title} locale={locale} viewAllLabel={t('viewAll')} />
      <Rail label={block.title} previousLabel={t('previous')} nextLabel={t('next')} perView={6}>
        {block.items.map((vendor) => (
          <RailItem key={vendor.id}>
            <TargetLink target={vendor.target} locale={locale} className={styles.brand} aria-label={vendor.name}>
              {vendor.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                <img src={vendor.image.url} alt="" loading="lazy" decoding="async" className={styles.logo} />
              ) : (
                <span className={styles.name}>{vendor.name}</span>
              )}
            </TargetLink>
          </RailItem>
        ))}
      </Rail>
      <p>
        <Link href={routes.vendors(locale)}>{t('vendorsViewAll')}</Link>
      </p>
    </section>
  );
}
