import type { Locale, Tile } from '@/sdk';
import { TargetLink } from '../ui/TargetLink';
import styles from './Catalog.module.css';

/** Brand tiles (logo and name), each linking through its Target. */
export function BrandGrid({ items, locale }: { items: Tile[]; locale: Locale }) {
  return (
    <ul className={styles.brands} data-testid="brand-grid">
      {items.map((brand) => (
        <li key={brand.id}>
          <TargetLink target={brand.target} locale={locale} className={styles.brand}>
            <span className={styles.brandMedia}>
              {brand.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                <img src={brand.image.url} alt="" loading="lazy" decoding="async" className={styles.brandImage} />
              ) : (
                <span className={styles.placeholder} aria-hidden="true" />
              )}
            </span>
            <span className={styles.brandName}>{brand.name}</span>
          </TargetLink>
        </li>
      ))}
    </ul>
  );
}
