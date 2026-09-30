import { useId } from 'react';
import type { CartItem, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Money, Price } from '@/money';
import { TargetLink } from '../ui/TargetLink';
import { canChangeQuantity, formatQuantity, limitsFor, stepDown, stepUp } from './quantity';
import styles from './CartLineItem.module.css';

interface CartLineItemProps {
  item: CartItem;
  locale: Locale;
  /** Quantity to show while an update is on its way (optimistic). Defaults to the backend's. */
  quantity?: number;
  /** This line has an update in flight: its prices are the previous ones until the API answers. */
  pending?: boolean;
  /** Another cart update is in flight: controls are locked so answers can't arrive out of order. */
  disabled?: boolean;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
}

/**
 * One cart line. Prices, line total and availability are shown exactly as the backend
 * sent them; the stepper only offers quantities inside the backend's limits.
 */
export function CartLineItem({ item, locale, quantity = item.quantity, pending = false, disabled = false, onQuantityChange, onRemove }: CartLineItemProps) {
  const t = translator(locale);
  const nameId = useId();
  const { product, availability } = item;
  const available = availability.status === 'available';
  const limits = limitsFor(item);
  const adjustable = canChangeQuantity(availability) && !disabled && Boolean(onQuantityChange);
  const down = adjustable ? stepDown(quantity, limits) : null;
  const up = adjustable ? stepUp(quantity, limits) : null;

  const classes = [styles.line, available ? '' : styles.unavailable, pending ? styles.pending : ''].filter(Boolean).join(' ');

  return (
    <article className={classes} data-testid="cart-line" data-status={availability.status} aria-busy={pending || undefined} aria-labelledby={nameId}>
      <div className={styles.media}>
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
          <img src={product.image.url} alt={product.image.alt ?? product.name} loading="lazy" decoding="async" className={styles.image} />
        ) : (
          <div className={styles.placeholder} aria-hidden="true" />
        )}
      </div>

      <div className={styles.details}>
        <div className={styles.head}>
          <div className={styles.info}>
            {product.brand && <p className={styles.brand}>{product.brand.name}</p>}
            <h3 id={nameId} className={styles.name}>
              <TargetLink target={product.target} locale={locale}>
                {product.name}
              </TargetLink>
            </h3>
            <p className={styles.unitPrice}>
              <span className="visually-hidden">{t('cartUnitPrice')}</span>
              <Price
                price={item.unitPrice}
                locale={locale}
                className={styles.priceParts}
                classNames={{ sale: styles.sale, compareAt: styles.compareAt, discount: styles.discount }}
              />
            </p>
          </div>
          <p className={styles.lineTotal} data-testid="cart-line-total">
            <span className="visually-hidden">{t('cartLineTotal')}</span>
            <Money value={item.lineTotal} />
          </p>
        </div>

        {product.requiresPrescription && <p className={styles.badge}>{t('prescription')}</p>}

        {!available && (
          <p className={styles.availability} data-testid="cart-line-availability">
            {availability.message ?? t('cartItemUnavailable')}
          </p>
        )}

        <div className={styles.controls}>
          <div className={styles.stepper} role="group" aria-label={t('cartQuantity')}>
            <button
              type="button"
              className={styles.step}
              aria-label={t('cartDecrease')}
              disabled={down === null}
              onClick={() => down !== null && onQuantityChange?.(down)}
            >
              <span aria-hidden="true">−</span>
            </button>
            <output className={styles.quantity} data-testid="cart-quantity" aria-live="polite">
              {formatQuantity(quantity, locale)}
            </output>
            <button
              type="button"
              className={styles.step}
              aria-label={t('cartIncrease')}
              disabled={up === null}
              onClick={() => up !== null && onQuantityChange?.(up)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <button type="button" className={styles.remove} disabled={disabled || !onRemove} onClick={onRemove}>
            {t('cartRemove')}
          </button>
        </div>
      </div>
    </article>
  );
}
