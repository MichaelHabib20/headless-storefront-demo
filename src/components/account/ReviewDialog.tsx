'use client';

import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import type { WriteReviewFields, WriteReviewResult } from '@/lib/reviews.actions';
import { fillTemplate } from '../product/details';
import { StarInput } from './StarInput';
import styles from './Account.module.css';

export type WriteReviewAction = (locale: Locale, fields: WriteReviewFields) => Promise<WriteReviewResult>;

interface ReviewDialogProps {
  locale: Locale;
  productId: number;
  productName: string;
  /** `Order.id` when the review is written from a delivered order. */
  orderId?: string | null;
  writeReviewAction: WriteReviewAction;
  onDone: (result: WriteReviewResult) => void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]';

/** Modal review form: stars + text. The backend's answer (thanks, or its refusal) goes back to the caller. */
export function ReviewDialog({ locale, productId, productName, orderId = null, writeReviewAction, onDone, onClose }: ReviewDialogProps) {
  const t = translator(locale);
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState<WriteReviewResult | null>(null);
  const [pending, startTransition] = useTransition();

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) return;
    const comment = String(new FormData(event.currentTarget).get('comment') ?? '').trim();
    if (!comment) return;
    setError(null);
    startTransition(async () => {
      let result: WriteReviewResult;
      try {
        result = await writeReviewAction(locale, { productId, rating, comment, orderId });
      } catch {
        result = { ok: false, message: t('reviewError') };
      }
      if (result.ok) onDone(result);
      else setError(result);
    });
  }

  const fieldErrors = error && !error.ok ? error.fieldErrors : undefined;

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && !pending && onClose()}>
      <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} data-testid="review-dialog">
        <h2 id={titleId} className={styles.dialogTitle}>
          {fillTemplate(t('reviewFor'), { product: productName })}
        </h2>
        <form onSubmit={submit} className={styles.form} aria-busy={pending || undefined}>
          {error && (
            <p className={styles.error} role="alert">
              {error.message}
            </p>
          )}
          <StarInput locale={locale} name="rating" label={t('reviewRating')} required value={rating} onChange={setRating} />
          <div className={styles.field}>
            <label htmlFor={`${titleId}-comment`} className={styles.label}>
              {t('reviewComment')}
            </label>
            <textarea id={`${titleId}-comment`} name="comment" className={styles.textarea} maxLength={2000} required aria-invalid={fieldErrors?.comment ? true : undefined} />
            {fieldErrors?.comment && <p className={styles.fieldError}>{fieldErrors.comment}</p>}
            {fieldErrors?.orderId && <p className={styles.fieldError}>{fieldErrors.orderId}</p>}
          </div>
          <div className={styles.dialogActions}>
            <button type="submit" className={styles.primary} disabled={rating === null || pending}>
              {pending ? t('reviewSending') : t('reviewSubmit')}
            </button>
            <button type="button" className={styles.secondary} onClick={onClose} disabled={pending}>
              {t('reviewCancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
