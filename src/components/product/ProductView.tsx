import type { ReactNode } from 'react';
import type { Locale, ProductDetails } from '@/sdk';
import { translator } from '@/lib/i18n';
import { DiscountLabel, Price } from '@/money';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { RichText } from '../ui/RichText';
import { TargetLink } from '../ui/TargetLink';
import { badgeText, quantityLimits, ratingLabel, ratingText, reviewCountLabel } from './details';
import { NotifyMe, type NotifyMeAction } from './NotifyMe';
import { ProductActions } from './ProductActions';
import { ProductGallery } from './ProductGallery';
import { ProductOptions } from './ProductOptions';
import { REVIEWS_ID } from './ProductReviews';
import { Stars } from './Stars';
import styles from './ProductView.module.css';

interface ProductViewProps {
  details: ProductDetails;
  locale: Locale;
  notifyMeAction: NotifyMeAction;
  /** Recommendation rows, loaded on their own (they never hold up the product). */
  recommendations?: ReactNode;
  /** Reviews, loaded on their own. */
  reviews?: ReactNode;
}

/**
 * The product page. Everything on it is the backend's decision, drawn as it is: the variant shown,
 * price and discount, badges, what every option value opens, the stock message, whether it can be
 * bought and in what quantities, notify-me, texts, specifications and the breadcrumb trail.
 */
export function ProductView({ details, locale, notifyMeAction, recommendations, reviews }: ProductViewProps) {
  const t = translator(locale);
  const { product, availability } = details;
  const badges = [...(product.requiresPrescription ? [t('prescription')] : []), ...product.badges.map((badge) => badgeText(badge, t))].filter(
    (text): text is string => Boolean(text),
  );

  return (
    <div className={`container ${styles.page}`} data-testid="product-page">
      <Breadcrumbs items={details.breadcrumbs} locale={locale} label={t('productBreadcrumbs')} />

      <div className={styles.top}>
        <ProductGallery
          images={details.gallery}
          video={details.video}
          name={product.name}
          locale={locale}
          labels={{
            gallery: t('productGallery'),
            imageOf: t('productImageOf'),
            video: t('productVideo'),
            playVideo: t('productPlayVideo'),
            previous: t('productPreviousImage'),
            next: t('productNextImage'),
          }}
        />

        <div className={styles.info}>
          <header className={styles.header}>
            {product.brand && (
              <TargetLink target={product.brand.target} locale={locale} className={styles.brand}>
                {product.brand.name}
              </TargetLink>
            )}
            <h1 className={styles.name}>{product.name}</h1>
            {product.rating && (
              <a href={`#${REVIEWS_ID}`} className={styles.rating} data-testid="product-rating">
                <Stars value={product.rating.average} label={ratingLabel(product.rating.average, locale, t)} />
                <span aria-hidden="true">{ratingText(product.rating.average, locale)}</span>
                <span className={styles.ratingCount}>{reviewCountLabel(product.rating.count, locale, t)}</span>
              </a>
            )}
          </header>

          {badges.length > 0 && (
            <ul className={styles.badges} data-testid="product-badges">
              {badges.map((text, i) => (
                <li key={i} className={styles.badge}>
                  {text}
                </li>
              ))}
            </ul>
          )}

          <div className={styles.priceRow}>
            <Price
              price={product.price}
              locale={locale}
              as="p"
              className={styles.price}
              classNames={{ sale: styles.sale, compareAt: styles.compareAt }}
              showDiscount={false}
              data-testid="product-price"
            />
            <DiscountLabel price={product.price} className={styles.discount} data-testid="product-discount" />
          </div>

          {details.notices.length > 0 && (
            <ul className={styles.notices} data-testid="product-notices">
              {details.notices.map((notice, i) => (
                <li key={i} className={styles.notice} data-kind={notice.kind}>
                  {notice.text}
                </li>
              ))}
            </ul>
          )}

          <RichText value={details.summary} className={styles.summary} data-testid="product-summary" />

          <ProductOptions
            options={details.options}
            locale={locale}
            labels={{ selected: t('productOptionSelected'), outOfStock: t('productOptionOutOfStock'), unavailable: t('productOptionUnavailable') }}
          />

          {availability.message && (
            <p className={styles.availability} data-status={availability.status} data-testid="product-availability">
              {availability.message}
            </p>
          )}

          <ProductActions
            productId={product.id}
            productName={product.name}
            locale={locale}
            canAddToCart={product.purchase.canAddToCart}
            addQuantity={product.purchase.minQuantity}
            quantity={{
              limits: quantityLimits(details),
              labels: { quantity: t('cartQuantity'), decrease: t('cartDecrease'), increase: t('cartIncrease'), update: t('productUpdateCart') },
            }}
            labels={{
              addToCart: t('addToCart'),
              inCart: t('cardInCart'),
              wishlist: t('cardWishlist'),
              compare: t('cardCompare'),
              failed: t('statusActionFailed'),
            }}
          />

          {availability.notifyMe && (
            <NotifyMe
              productId={product.id}
              locale={locale}
              action={notifyMeAction}
              labels={{ button: t('productNotifyMe'), email: t('productNotifyEmail'), failed: t('productNotifyFailed') }}
            />
          )}

          {details.sku && (
            <p className={styles.sku}>
              <span className={styles.skuLabel}>{t('productSku')}</span> <span data-testid="product-sku">{details.sku}</span>
            </p>
          )}
        </div>
      </div>

      {(details.description || details.specifications.length > 0) && (
        <div className={styles.more}>
          {details.description && (
            <section className={styles.block} aria-labelledby="product-description">
              <h2 id="product-description" className={styles.blockTitle}>
                {t('productDescription')}
              </h2>
              <RichText value={details.description} data-testid="product-description" />
            </section>
          )}
          {details.specifications.length > 0 && (
            <section className={styles.block} aria-labelledby="product-specifications">
              <h2 id="product-specifications" className={styles.blockTitle}>
                {t('productSpecifications')}
              </h2>
              <table className={styles.specs} data-testid="product-specifications">
                <tbody>
                  {details.specifications.map((row, i) => (
                    <tr key={i}>
                      <th scope="row">{row.name}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {recommendations}
      {reviews}
    </div>
  );
}
