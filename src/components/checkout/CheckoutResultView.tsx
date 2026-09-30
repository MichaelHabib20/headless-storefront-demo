import Link from 'next/link';
import type { CheckoutOrder, CheckoutResult, Locale } from '@/sdk';
import { formatQuantity } from '@/components/cart/quantity';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Money } from '@/money';
import { TargetLink } from '../ui/TargetLink';
import { ResultPoller } from './ResultPoller';
import { TotalLines } from './TotalLines';
import styles from './Checkout.module.css';

interface CheckoutResultViewProps {
  /** `GET /checkout/result`: the real state of the order or payment. */
  result: CheckoutResult;
  locale: Locale;
}

/**
 * What happened to the order, as the backend says (never as the URL says):
 * placed / paid → thank you with the order; pending → wait and ask again; failed / cancelled →
 * the backend's message, and a way back to checkout when it says the cart is still there.
 * A status this storefront does not know yet is shown with its message and a link to the orders.
 */
export function CheckoutResultView({ result, locale }: CheckoutResultViewProps) {
  const t = translator(locale);

  switch (result.status) {
    case 'placed':
    case 'paid':
      return (
        <div className={`container ${styles.result}`} data-testid="checkout-result" data-status={result.status}>
          <h1 className={styles.resultTitle}>{t('resultTitlePlaced')}</h1>
          {result.message && <p className={styles.resultMessage}>{result.message}</p>}
          {result.order && <PlacedOrder order={result.order} locale={locale} />}
          <div className={styles.resultActions}>
            {result.order ? (
              <Link href={routes.order(locale, result.order.id)} className={styles.button}>
                {t('resultViewOrder')}
              </Link>
            ) : (
              <Link href={routes.orders(locale)} className={styles.button}>
                {t('resultOrders')}
              </Link>
            )}
            <Link href={routes.home(locale)} className={`${styles.button} ${styles.buttonQuiet}`}>
              {t('backHome')}
            </Link>
          </div>
        </div>
      );
    case 'pending':
      return <ResultPoller locale={locale} message={result.message} />;
    case 'failed':
    case 'cancelled':
      return (
        <div className={`container ${styles.result}`} data-testid="checkout-result" data-status={result.status}>
          <h1 className={styles.resultTitle}>{t('resultTitleFailed')}</h1>
          {result.message && (
            <p className={styles.resultMessage} role="alert">
              {result.message}
            </p>
          )}
          <div className={styles.resultActions}>
            {result.retry && (
              <Link href={routes.checkout(locale)} className={styles.button}>
                {t('resultRetry')}
              </Link>
            )}
            <Link href={routes.home(locale)} className={`${styles.button} ${styles.buttonQuiet}`}>
              {t('backHome')}
            </Link>
          </div>
        </div>
      );
    default:
      return <ResultUnknown locale={locale} message={result.message} />;
  }
}

/** No reference, a reference the backend does not know, or a status from a newer contract. */
export function ResultUnknown({ locale, message = null }: { locale: Locale; message?: string | null }) {
  const t = translator(locale);
  return (
    <div className={`container ${styles.result}`} data-testid="checkout-result" data-status="unknown">
      <h1 className={styles.resultTitle}>{t('resultTitleUnknown')}</h1>
      <p className={styles.resultMessage}>{message ?? t('resultUnknownText')}</p>
      <div className={styles.resultActions}>
        <Link href={routes.orders(locale)} className={styles.button}>
          {t('resultOrders')}
        </Link>
        <Link href={routes.home(locale)} className={`${styles.button} ${styles.buttonQuiet}`}>
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}

function PlacedOrder({ order, locale }: { order: CheckoutOrder; locale: Locale }) {
  const t = translator(locale);
  const { fulfilment, payment } = order;
  const pickup = fulfilment.branch ? [fulfilment.branch.name, fulfilment.branch.address].filter(Boolean).join(' — ') : null;

  return (
    <div className={styles.resultCard} data-testid="result-order">
      <dl className={styles.resultFacts}>
        <div>
          <dt>{t('resultOrderNumber')}</dt>
          <dd className={styles.orderNumber} data-testid="result-order-number">
            {order.number}
          </dd>
        </div>
        {fulfilment.address && (
          <div>
            <dt>{t('resultDeliveryTo')}</dt>
            <dd data-testid="result-fulfilment">{fulfilment.address}</dd>
          </div>
        )}
        {pickup && (
          <div>
            <dt>{t('resultPickupFrom')}</dt>
            <dd data-testid="result-fulfilment">{pickup}</dd>
          </div>
        )}
        {payment.method && (
          <div>
            <dt>{t('resultPayment')}</dt>
            <dd data-testid="result-payment">{payment.method}</dd>
          </div>
        )}
        {order.note && (
          <div>
            <dt>{t('resultNote')}</dt>
            <dd>{order.note}</dd>
          </div>
        )}
      </dl>

      <section aria-labelledby="result-items-title">
        <h2 id="result-items-title" className={styles.sectionTitle}>
          {t('resultItems')}
        </h2>
        <ul className={styles.items}>
          {order.items.map((item, index) => (
            <li key={index} className={styles.item} data-testid="result-item">
              <div className={styles.itemMedia}>
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                  <img src={item.image.url} alt="" loading="lazy" decoding="async" className={styles.itemImage} />
                )}
              </div>
              <div className={styles.itemInfo}>
                <h3 className={styles.itemName}>
                  <TargetLink target={item.target} locale={locale}>
                    {item.name}
                  </TargetLink>
                </h3>
                <p className={styles.itemQuantity}>
                  {t('cartQuantity')}: {formatQuantity(item.quantity, locale)}
                </p>
              </div>
              <Money value={item.lineTotal} as="p" className={styles.itemTotal} />
            </li>
          ))}
        </ul>
      </section>

      <TotalLines lines={order.totals.lines} total={order.totals.total} locale={locale} />
    </div>
  );
}
