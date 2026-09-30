import Link from 'next/link';
import type { Cart, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Money } from '@/money';
import { Icon } from '../ui/Icon';
import { CheckoutBlockers } from './CheckoutBlockers';
import { MinimumOrderProgress } from './MinimumOrderProgress';
import { formatQuantity } from './quantity';
import styles from './CartSummary.module.css';

const BLOCKERS_ID = 'cart-checkout-blockers';

interface CartSummaryProps {
  cart: Cart;
  locale: Locale;
  /** A cart update is in flight: the numbers shown are the previous API answer. */
  pending?: boolean;
}

/**
 * Totals and checkout state, all from `cart.summary` / `cart.checkout`. Nothing here is
 * added up or decided by the storefront: checkout is enabled only when the backend says so.
 */
export function CartSummary({ cart, locale, pending = false }: CartSummaryProps) {
  const t = translator(locale);
  const { summary, checkout } = cart;
  const canCheckout = checkout.allowed && !pending;

  return (
    <aside
      className={`${styles.summary} ${pending ? styles.pending : ''}`}
      aria-labelledby="cart-summary-title"
      aria-busy={pending || undefined}
      data-testid="cart-summary"
    >
      <h2 id="cart-summary-title" className={styles.title}>
        {t('cartSummaryTitle')}
      </h2>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>{t('cartItemCount')}</dt>
          <dd data-testid="cart-item-count">{formatQuantity(summary.itemCount, locale)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('cartSubtotal')}</dt>
          <Money value={summary.subtotal} as="dd" data-testid="cart-subtotal" />
        </div>
        {summary.discount && (
          <div className={`${styles.row} ${styles.discount}`}>
            <dt>{t('cartDiscount')}</dt>
            <Money value={summary.discount} as="dd" data-testid="cart-discount" />
          </div>
        )}
        <div className={`${styles.row} ${styles.total}`}>
          <dt>{t('cartTotal')}</dt>
          <Money value={summary.total} as="dd" data-testid="cart-total" />
        </div>
      </dl>
      <p className={styles.note}>{t('cartDeliveryNote')}</p>

      {checkout.minimumOrder && (
        <MinimumOrderProgress
          minimumOrder={checkout.minimumOrder}
          reached={!checkout.blockers.some((blocker) => blocker.code === 'minimum_order')}
          locale={locale}
        />
      )}

      {cart.requiresPrescription && (
        <p className={styles.prescription} data-testid="cart-prescription">
          {t('cartPrescriptionNotice')}
        </p>
      )}

      <CheckoutBlockers blockers={checkout.blockers} locale={locale} id={BLOCKERS_ID} />

      {canCheckout ? (
        <Link href={routes.checkout(locale)} className={styles.checkout}>
          {t('cartCheckout')}
          <Icon name="arrow" size={20} directional />
        </Link>
      ) : (
        <button type="button" className={styles.checkout} disabled aria-describedby={checkout.blockers.length ? BLOCKERS_ID : undefined}>
          {t('cartCheckout')}
          <Icon name="arrow" size={20} directional />
        </button>
      )}
    </aside>
  );
}
