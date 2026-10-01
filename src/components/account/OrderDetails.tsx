import Link from 'next/link';
import type { CancellationReason, Locale, Order } from '@/sdk';
import { formatDate } from '@/lib/dates';
import { translator } from '@/lib/i18n';
import { formatNumber } from '@/lib/numbers';
import { externalHref, routes } from '@/lib/routing';
import { Money } from '@/money';
import { Icon } from '../ui/Icon';
import { TargetLink } from '../ui/TargetLink';
import { ItemReview } from './ItemReview';
import { OrderActions } from './OrderActions';
import { OrderRating } from './OrderRating';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { WriteReviewAction } from './ReviewDialog';
import type { CancelOrderAction, RateOrderAction, ReorderAction } from './types';
import styles from './Account.module.css';

interface OrderDetailsProps {
  order: Order;
  locale: Locale;
  /** `getOrderCancellationReasons`, loaded only when the order can be cancelled; null when it failed. */
  reasons?: CancellationReason[] | null;
  /** The shopper's own order page has the actions; the public tracking page has none (read-only). */
  cancelAction?: CancelOrderAction;
  reorderAction?: ReorderAction;
  rateAction?: RateOrderAction;
  writeReviewAction?: WriteReviewAction;
  timeZone?: string;
}

/**
 * One order exactly as the API describes it: status, steps, where it goes, how it is paid, the
 * lines, the price breakdown and what the shopper may do now (`actions`). Nothing is added up here.
 */
export function OrderDetails({ order, locale, reasons = null, cancelAction, reorderAction, rateAction, writeReviewAction, timeZone }: OrderDetailsProps) {
  const t = translator(locale);
  const { fulfilment, payment, totals } = order;
  const branch = fulfilment.branch;
  const mapHref = externalHref(branch?.mapUrl);
  const reviewable = Boolean(order.actions.canReviewProducts && writeReviewAction);

  return (
    <article className={`container ${styles.page}`} data-testid="order" data-order-id={order.id}>
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <Link href={routes.orders(locale)} className={styles.back}>
            <Icon name="chevron" size={16} className={styles.backIcon} />
            {t('orderBack')}
          </Link>
          <h1 className={styles.title}>{t('orderNumber').replace('{number}', order.number)}</h1>
          <div className={styles.orderHead}>
            <OrderStatusBadge status={order.status} />
            <p className={styles.subtitle}>
              {t('ordersPlacedOn')} <time dateTime={order.placedAt}>{formatDate(order.placedAt, locale, { timeZone })}</time>
            </p>
          </div>
        </div>
      </header>

      {order.timeline.length > 0 && (
        <ol className={styles.timeline} aria-label={t('orderTimeline')} data-testid="order-timeline">
          {order.timeline.map((step, index) => (
            <li
              key={`${index}-${step.label}`}
              className={styles.step}
              data-done={step.done}
              data-current={step.current}
              aria-current={step.current ? 'step' : undefined}
            >
              {step.label}
              {step.current ? (
                <span className="visually-hidden"> ({t('orderStepCurrent')})</span>
              ) : (
                step.done && <span className="visually-hidden"> ({t('orderStepDone')})</span>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className={styles.orderLayout}>
        <section aria-labelledby="order-items-title">
          <h2 id="order-items-title" className={styles.sectionTitle}>
            {t('orderItems')}
          </h2>
          <ul className={styles.items}>
            {order.items.map((item, index) => (
              <li key={`${index}-${item.name}`} className={styles.item} data-testid="order-item">
                <div className={styles.itemMedia}>
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                    <img src={item.image.url} alt={item.image.alt ?? item.name} loading="lazy" decoding="async" className={styles.itemImage} />
                  )}
                </div>
                <div>
                  <h3 className={styles.itemName}>
                    <TargetLink target={item.target} locale={locale}>
                      {item.name}
                    </TargetLink>
                  </h3>
                  <p className={styles.muted}>
                    {t('orderQuantity')}: <span data-testid="order-item-quantity">{formatNumber(item.quantity, locale)}</span>
                  </p>
                  {reviewable && typeof item.productId === 'number' && writeReviewAction && (
                    <ItemReview locale={locale} orderId={order.id} productId={item.productId} productName={item.name} writeReviewAction={writeReviewAction} />
                  )}
                </div>
                <p className={styles.itemPrices}>
                  <span className="visually-hidden">{t('orderLineTotal')}</span>
                  <Money value={item.lineTotal} className={styles.lineTotal} data-testid="order-item-total" />
                  {item.compareAt && (
                    <>
                      <span className="visually-hidden">{t('orderBeforeDiscount')}</span>
                      <Money value={item.compareAt} as="span" className={styles.compareAt} data-testid="order-item-compare-at" />
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.side}>
          <section className={styles.panel} aria-labelledby="order-totals-title" data-testid="order-totals">
            <h2 id="order-totals-title" className={styles.panelTitle}>
              {t('orderTotals')}
            </h2>
            <dl className={styles.totals}>
              {totals.lines.map((line, index) => (
                <div key={`${index}-${line.kind}`} className={styles.totalRow} data-kind={line.kind} data-testid="order-total-line">
                  <dt>{line.label}</dt>
                  {line.amount ? <Money value={line.amount} as="dd" /> : <dd>{line.text}</dd>}
                </div>
              ))}
              <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                <dt>{t('orderTotal')}</dt>
                <Money value={totals.total} as="dd" data-testid="order-grand-total" />
              </div>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="order-fulfilment-title" data-testid="order-fulfilment" data-type={fulfilment.type}>
            <h2 id="order-fulfilment-title" className={styles.panelTitle}>
              {branch ? t('orderPickup') : t('orderDelivery')}
            </h2>
            {branch ? (
              <>
                <p className={styles.panelText}>
                  <strong>{branch.name}</strong>
                </p>
                {branch.address && <p className={styles.panelText}>{branch.address}</p>}
                {branch.phone && (
                  <p className={styles.panelText}>
                    {t('orderBranchPhone')}: <span dir="ltr">{branch.phone}</span>
                  </p>
                )}
                {mapHref && (
                  <a href={mapHref} target="_blank" rel="noopener noreferrer" className={styles.back}>
                    {t('orderMap')}
                  </a>
                )}
              </>
            ) : (
              fulfilment.address && <p className={styles.panelText}>{fulfilment.address}</p>
            )}
          </section>

          {(payment.method || payment.online) && (
            <section className={styles.panel} aria-labelledby="order-payment-title" data-testid="order-payment">
              <h2 id="order-payment-title" className={styles.panelTitle}>
                {t('orderPayment')}
              </h2>
              {payment.method && <p className={styles.panelText}>{payment.method}</p>}
              {payment.online && <p className={styles.muted}>{t('orderOnlinePayment')}</p>}
            </section>
          )}

          {order.note && (
            <section className={styles.panel} aria-labelledby="order-note-title">
              <h2 id="order-note-title" className={styles.panelTitle}>
                {t('orderNote')}
              </h2>
              <p className={styles.panelText} data-testid="order-note">
                {order.note}
              </p>
            </section>
          )}

          {rateAction && <OrderRating locale={locale} order={order} rateAction={rateAction} />}

          {cancelAction && reorderAction && (
            <OrderActions
              locale={locale}
              orderId={order.id}
              canCancel={order.actions.canCancel}
              canReorder={order.actions.canReorder}
              reasons={reasons}
              cancelAction={cancelAction}
              reorderAction={reorderAction}
            />
          )}
        </div>
      </div>
    </article>
  );
}
