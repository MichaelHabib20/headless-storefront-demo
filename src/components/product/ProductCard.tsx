import type { Locale, ProductCard as ProductCardData } from '@/sdk';
import { formatPrice } from '@/lib/format';
import { translator } from '@/lib/i18n';
import { TargetLink } from '../ui/TargetLink';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: ProductCardData;
  locale: Locale;
}

/**
 * Shows what the backend decided: price, discount, stock, badges. It never computes
 * a price or an eligibility rule itself.
 */
export function ProductCard({ product, locale }: ProductCardProps) {
  const t = translator(locale);
  const price = product.price ? formatPrice(product.price, locale) : null;

  return (
    <article className={styles.card} data-testid="product-card">
      <TargetLink target={product.target} locale={locale} className={styles.link}>
        <div className={styles.media}>
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
            <img src={product.image.url} alt={product.image.alt ?? product.name} loading="lazy" decoding="async" className={styles.image} />
          ) : (
            <div className={styles.placeholder} aria-hidden="true" />
          )}
          {price?.discount && <span className={styles.discount}>{price.discount}</span>}
          {!product.inStock && <span className={styles.soldOut}>{t('outOfStock')}</span>}
        </div>

        <div className={styles.body}>
          {price && (
            <p className={styles.price}>
              <span className={product.price?.compareAt ? styles.sale : undefined}>{price.amount}</span>
              {price.compareAt && <s className={styles.compareAt}>{price.compareAt}</s>}
            </p>
          )}
          <h3 className={styles.name}>{product.name}</h3>
          {product.brand && <p className={styles.brand}>{product.brand.name}</p>}
          <ul className={styles.badges}>
            {product.requiresPrescription && <li className={styles.badge}>{t('prescription')}</li>}
            {product.badges.map((badge, i) => (
              <li key={`${badge.kind}-${i}`} className={styles.badge}>
                {badge.text ?? (badge.kind === 'preorder' ? t('preorder') : badge.kind === 'coming_soon' ? t('comingSoonBadge') : null)}
              </li>
            ))}
          </ul>
        </div>
      </TargetLink>
    </article>
  );
}
