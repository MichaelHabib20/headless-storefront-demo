import type { Locale, Tile } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Icon } from '../ui/Icon';
import { Rail, RailItem } from '../ui/Rail';
import { SectionHeading } from '../ui/SectionHeading';
import { TargetLink } from '../ui/TargetLink';
import styles from './CategoryTiles.module.css';

/** "Shop by category": image tiles with a label box and arrow. */
export function CategoryTiles({ tiles, locale }: { tiles: Tile[]; locale: Locale }) {
  if (!tiles.length) return null;
  const t = translator(locale);

  return (
    <section className={`container ${styles.section}`} aria-labelledby="shop-by-category">
      <SectionHeading id="shop-by-category" title={t('shopByCategory')} locale={locale} viewAllLabel={t('viewAll')} />
      <Rail label={t('shopByCategory')} previousLabel={t('previous')} nextLabel={t('next')} perView={4}>
        {tiles.map((tile) => (
          <RailItem key={tile.id}>
            <TargetLink target={tile.target} locale={locale} className={styles.tile}>
              <div className={styles.media}>
                {tile.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                  <img src={tile.image.url} alt="" loading="lazy" decoding="async" className={styles.image} />
                )}
              </div>
              <span className={styles.label}>
                {tile.name}
                <Icon name="arrow" size={20} directional />
              </span>
            </TargetLink>
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
