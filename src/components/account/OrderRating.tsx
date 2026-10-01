'use client';

import { useRef, useState } from 'react';
import type { Locale, Order } from '@/sdk';
import { translator } from '@/lib/i18n';
import { formatNumber } from '@/lib/numbers';
import { fillTemplate } from '../product/details';
import { Stars } from '../product/Stars';
import { RateOrderDialog } from './RateOrderDialog';
import type { RateOrderAction, RateOrderResult } from './types';
import styles from './Account.module.css';
import ratingStyles from './Rating.module.css';

interface OrderRatingProps {
  locale: Locale;
  order: Order;
  rateAction: RateOrderAction;
}

/**
 * The order's rating panel: the rating the shopper gave (`order.rating`), or the "rate" button when
 * the API allows it (`actions.canRate` + `ratingForm`). Nothing is decided here: without both, the
 * panel is empty and renders nothing.
 */
export function OrderRating({ locale, order, rateAction }: OrderRatingProps) {
  const t = translator(locale);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RateOrderResult | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const canRate = Boolean(order.actions.canRate && order.ratingForm);

  if (!order.rating && !canRate && !status) return null;

  const label = (value: number) => fillTemplate(t('ratingOutOf'), { rating: formatNumber(value, locale), max: formatNumber(5, locale) });

  return (
    <section className={styles.panel} aria-labelledby="order-rating-title" data-testid="order-rating">
      <h2 id="order-rating-title" className={styles.panelTitle}>
        {t('orderRatingTitle')}
      </h2>
      {status && (
        <p className={status.ok ? styles.success : styles.error} role={status.ok ? 'status' : 'alert'} data-testid="order-rating-status">
          {status.message}
        </p>
      )}
      {order.rating ? (
        <>
          <p className={ratingStyles.ratingRow}>
            <Stars value={order.rating.rating} label={label(order.rating.rating)} />
          </p>
          {order.rating.driverRating !== null && (
            <p className={ratingStyles.ratingRow}>
              <span className={styles.muted}>{t('orderRatingDriver')}</span>
              <Stars value={order.rating.driverRating} label={label(order.rating.driverRating)} />
            </p>
          )}
          {order.rating.feedback && (
            <p className={styles.panelText} data-testid="order-rating-feedback">
              <span className={styles.muted}>{t('orderRatingFeedback')}: </span>
              {order.rating.feedback}
            </p>
          )}
        </>
      ) : (
        canRate && (
          <button ref={button} type="button" className={styles.primary} onClick={() => setOpen(true)} aria-haspopup="dialog">
            {t('orderRate')}
          </button>
        )
      )}

      {open && order.ratingForm && (
        <RateOrderDialog
          locale={locale}
          orderId={order.id}
          form={order.ratingForm}
          items={order.items}
          rateAction={rateAction}
          onDone={(result) => {
            setOpen(false);
            if (result.message) setStatus(result);
          }}
          onClose={() => {
            setOpen(false);
            button.current?.focus();
          }}
        />
      )}
    </section>
  );
}
