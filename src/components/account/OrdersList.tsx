import Link from 'next/link';
import type { Locale, OrdersPage } from '@/sdk';
import { formatDate } from '@/lib/dates';
import { translator } from '@/lib/i18n';
import { formatNumber } from '@/lib/numbers';
import { routes } from '@/lib/routing';
import { Money } from '@/money';
import { Pagination } from '../ui/Pagination';
import { OrderStatusBadge } from './OrderStatusBadge';
import styles from './Account.module.css';

interface OrdersListProps {
  orders: OrdersPage;
  locale: Locale;
  /** Forces a time zone (tests); by default dates are on the store's clock (src/lib/dates.ts). */
  timeZone?: string;
}

/** The shopper's orders as the API lists them (newest first), with its pages. */
export function OrdersList({ orders, locale, timeZone }: OrdersListProps) {
  const t = translator(locale);

  if (!orders.items.length) {
    return (
      <div className={styles.state} data-testid="orders-empty">
        <h2 className={styles.stateTitle}>{t('ordersEmptyTitle')}</h2>
        <p className={styles.stateText}>{t('ordersEmptyText')}</p>
        <Link href={routes.home(locale)} className={styles.primary}>
          {t('ordersStartShopping')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <ol className={styles.orderList} data-testid="orders">
        {orders.items.map((order) => (
          <li key={order.id} className={styles.orderRow} data-testid="order-summary" data-order-id={order.id}>
            <h2 className={styles.orderNumber}>
              <Link href={routes.order(locale, order.id)}>{t('orderNumber').replace('{number}', order.number)}</Link>
            </h2>
            <dl className={styles.orderMeta}>
              <dt>{t('ordersStatus')}</dt>
              <dd>
                <OrderStatusBadge status={order.status} />
              </dd>
            </dl>
            <dl className={styles.orderMeta}>
              <dt>{t('ordersPlacedOn')}</dt>
              <dd>
                <time dateTime={order.placedAt}>{formatDate(order.placedAt, locale, { timeZone })}</time>
              </dd>
            </dl>
            <dl className={styles.orderMeta}>
              <dt>{t('ordersItemCount')}</dt>
              <dd data-testid="order-item-count">{formatNumber(order.itemCount, locale)}</dd>
            </dl>
            <dl className={styles.orderMeta}>
              <dt>{t('ordersTotal')}</dt>
              <Money value={order.total} as="dd" className={styles.orderTotal} data-testid="order-total" />
            </dl>
          </li>
        ))}
      </ol>
      <Pagination
        pagination={orders.pagination}
        baseHref={routes.orders(locale)}
        locale={locale}
        labels={{ nav: t('ordersPages'), previous: t('previous'), next: t('next'), page: t('ordersPage') }}
      />
    </>
  );
}
