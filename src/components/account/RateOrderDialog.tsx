'use client';

import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import type { Locale, Order, OrderRatingForm } from '@/sdk';
import { translator } from '@/lib/i18n';
import { StarInput } from './StarInput';
import type { RateOrderAction, RateOrderResult } from './types';
import styles from './Account.module.css';
import ratingStyles from './Rating.module.css';

interface RateOrderDialogProps {
  locale: Locale;
  orderId: string;
  /** `order.ratingForm`: which fields the dialog has. */
  form: OrderRatingForm;
  /** The order's items, for the per-product ratings when `form.items` is true. */
  items: Order['items'];
  rateAction: RateOrderAction;
  onDone: (result: RateOrderResult) => void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';

/**
 * Modal dialog drawn from `ratingForm`: the order's stars, the delivery stars (hidden / optional /
 * required as the API says), free text, and one star row per product when the store asks for it.
 * "Not now" sends `skip: true` (the backend remembers the dismissal); Escape just closes.
 */
export function RateOrderDialog({ locale, orderId, form, items, rateAction, onDone, onClose }: RateOrderDialogProps) {
  const t = translator(locale);
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [driverRating, setDriverRating] = useState<number | null>(null);
  const [itemRatings, setItemRatings] = useState<Record<number, number>>({});
  const [pending, startTransition] = useTransition();
  const products = form.items ? items.filter((item): item is Order['items'][number] & { productId: number } => typeof item.productId === 'number') : [];

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !pending) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialog.current) return;
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function send(input: Parameters<RateOrderAction>[2]) {
    startTransition(async () => {
      let result: RateOrderResult;
      try {
        result = await rateAction(locale, orderId, input);
      } catch {
        result = { ok: false, message: t('orderRateError') };
      }
      onDone(result);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) return;
    if (form.driverRating === 'required' && driverRating === null) return;
    const data = new FormData(event.currentTarget);
    send({
      rating: rating,
      driverRating: form.driverRating === 'hidden' ? null : driverRating,
      feedback: String(data.get('feedback') ?? '').trim() || null,
      skip: false,
      items: products
        .filter((item) => itemRatings[item.productId])
        .map((item) => ({ productId: item.productId, rating: itemRatings[item.productId], comment: String(data.get(`comment-${item.productId}`) ?? '').trim() || null })),
    });
  }

  const canSend = rating !== null && (form.driverRating !== 'required' || driverRating !== null);

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && !pending && onClose()}>
      <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} data-testid="rate-dialog">
        <h2 id={titleId} className={styles.dialogTitle}>
          {t('orderRateTitle')}
        </h2>
        <form onSubmit={submit} className={styles.form} aria-busy={pending || undefined}>
          <StarInput locale={locale} name="rating" label={t('orderRateQuestion')} required value={rating} onChange={setRating} />

          {form.driverRating !== 'hidden' && (
            <StarInput
              locale={locale}
              name="driverRating"
              label={form.driverRating === 'required' ? t('orderRateDriver') : `${t('orderRateDriver')} ${t('orderRateDriverOptional')}`}
              required={form.driverRating === 'required'}
              value={driverRating}
              onChange={setDriverRating}
            />
          )}

          <div className={styles.field}>
            <label htmlFor={`${titleId}-feedback`} className={styles.label}>
              {t('orderRateFeedback')}
            </label>
            <textarea id={`${titleId}-feedback`} name="feedback" className={styles.textarea} maxLength={1000} />
          </div>

          {products.length > 0 && (
            <section aria-label={t('orderRateItems')} data-testid="rate-items">
              <h3 className={styles.panelTitle}>{t('orderRateItems')}</h3>
              {products.map((item) => (
                <div key={item.productId} className={ratingStyles.itemRating}>
                  <span className={ratingStyles.itemName}>{item.name}</span>
                  <StarInput locale={locale} name={`item-${item.productId}`} label={item.name} value={itemRatings[item.productId] ?? null} onChange={(value) => setItemRatings((all) => ({ ...all, [item.productId]: value }))} />
                  <label className={styles.label}>
                    {t('orderRateItemComment')}
                    <input name={`comment-${item.productId}`} className={styles.input} maxLength={1000} />
                  </label>
                </div>
              ))}
            </section>
          )}

          <div className={styles.dialogActions}>
            <button type="submit" className={styles.primary} disabled={!canSend || pending}>
              {pending ? t('orderRateSending') : t('orderRateSubmit')}
            </button>
            <button type="button" className={styles.secondary} onClick={() => send({ rating: null, skip: true })} disabled={pending}>
              {t('orderRateSkip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
