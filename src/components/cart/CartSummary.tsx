import Link from 'next/link';
import type { Cart, Locale, Money } from '@/sdk';
import { formatMoney } from '@/lib/format';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
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
  const money = (value: Money) => formatMoney(value.amount, value.currency, locale);
  const canCheckout = checkout.allowed && !pending;

  // Store owner request: total = sum of every line's lineTotal, minus 5% when that sum is above 1000.
  const linesSum = cart.items.reduce((sum, item) => sum + item.lineTotal.amount, 0);
  const savings = linesSum > 1000 ? linesSum * 0.05 : 0;
  const computedTotal = linesSum - savings;
  const youSave = t('cartYouSave')
    .replace('{amount}', formatMoney(savings, null, locale))
    .replace('{currency}', summary.total.currency ?? '')
    .trim();

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
          <dd data-testid="cart-subtotal">{money(summary.subtotal)}</dd>
        </div>
        {summary.discount && (
          <div className={`${styles.row} ${styles.discount}`}>
            <dt>{t('cartDiscount')}</dt>
            <dd data-testid="cart-discount">{money(summary.discount)}</dd>
          </div>
        )}
        <div className={`${styles.row} ${styles.total}`}>
          <dt>{t('cartTotal')}</dt>
          <dd data-testid="cart-total">{formatMoney(computedTotal, summary.total.currency, locale)}</dd>
        </div>
      </dl>
      {savings > 0 && (
        <p className={styles.note} data-testid="cart-you-save">
          {youSave}
        </p>
      )}
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
