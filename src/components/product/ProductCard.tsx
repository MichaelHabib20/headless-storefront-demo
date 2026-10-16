import type { Locale, ProductCard as ProductCardData } from '@/sdk';
import { translator } from '@/lib/i18n';
import { DiscountLabel, Price } from '@/money';
import { ProductImage } from '../ui/ProductImage';
import { TargetLink } from '../ui/TargetLink';
import { ProductActions } from './ProductActions';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: ProductCardData;
  locale: Locale;
  /** Add-to-cart / wishlist / compare buttons. Off where the page has its own actions (e.g. wishlist). */
  showActions?: boolean;
}

/**
 * Shows what the backend decided: price, discount, stock, badges, whether it can be added to
 * the cart. It never computes a price or an eligibility rule itself. The shopper's own state
 * (in cart / wishlist / compare) reaches ProductActions through ShopperStateProvider.
 */
export function ProductCard({ product, locale, showActions = true }: ProductCardProps) {
  const t = translator(locale);

  return (
    <article className={styles.card} data-testid="product-card">
      <TargetLink target={product.target} locale={locale} className={styles.link}>
        <div className={styles.media}>
          <ProductImage src={product.image?.url} alt={product.image?.alt ?? product.name} className={styles.image} />
          <DiscountLabel price={product.price} className={styles.discount} />
          {!product.inStock && <span className={styles.soldOut}>{t('outOfStock')}</span>}
        </div>

        <div className={styles.body}>
          <Price
            price={product.price}
            locale={locale}
            as="p"
            className={styles.price}
            classNames={{ sale: styles.sale, compareAt: styles.compareAt }}
            showDiscount={false}
            data-testid="product-price"
          />
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
      {showActions && (
        <ProductActions
          productId={product.id}
          productName={product.name}
          locale={locale}
          canAddToCart={product.purchase.canAddToCart}
          addQuantity={product.purchase.minQuantity}
          labels={{
            addToCart: t('addToCart'),
            inCart: t('cardInCart'),
            wishlist: t('cardWishlist'),
            compare: t('cardCompare'),
            failed: t('statusActionFailed'),
          }}
        />
      )}
    </article>
  );
}
