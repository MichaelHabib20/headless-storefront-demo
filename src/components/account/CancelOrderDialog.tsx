'use client';

import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import type { CancellationReason, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import type { CancelOrderAction, CancelOrderResult } from './types';
import styles from './Account.module.css';

interface CancelOrderDialogProps {
  locale: Locale;
  orderId: string;
  /** The API's reasons; null when they could not be loaded. */
  reasons: CancellationReason[] | null;
  cancelAction: CancelOrderAction;
  /** The API answered (cancelled, or refused with its message). */
  onDone: (result: CancelOrderResult) => void;
  /** Closed without cancelling. */
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';

/**
 * Modal dialog: the API's cancellation reasons and an optional note. Focus moves in on open, stays
 * inside (Tab wraps), Escape closes, and the page gets it back on close.
 */
export function CancelOrderDialog({ locale, orderId, reasons, cancelAction, onDone, onClose }: CancelOrderDialogProps) {
  const t = translator(locale);
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [reasonId, setReasonId] = useState<number | null>(null);
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
    if (reasonId === null) return;
    const note = String(new FormData(event.currentTarget).get('note') ?? '').trim() || null;
    startTransition(async () => {
      let result: CancelOrderResult;
      try {
        result = await cancelAction(locale, orderId, reasonId, note);
      } catch {
        result = { ok: false, message: t('orderActionError') };
      }
      onDone(result);
    });
  }

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && !pending && onClose()}>
      <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} data-testid="cancel-dialog">
        <h2 id={titleId} className={styles.dialogTitle}>
          {t('orderCancelTitle')}
        </h2>

        {reasons ? (
          <form onSubmit={submit} className={styles.form} aria-busy={pending || undefined}>
            <fieldset className={styles.reasons}>
              <legend>{t('orderCancelReason')}</legend>
              {reasons.map((reason) => (
                <label key={reason.id} className={styles.reason}>
                  <input type="radio" name="reasonId" value={reason.id} checked={reasonId === reason.id} onChange={() => setReasonId(reason.id)} required />
                  {reason.text}
                </label>
              ))}
            </fieldset>
            <div className={styles.field}>
              <label htmlFor={`${titleId}-note`} className={styles.label}>
                {t('orderCancelNote')}
              </label>
              <textarea id={`${titleId}-note`} name="note" className={styles.textarea} maxLength={500} />
            </div>
            <div className={styles.dialogActions}>
              <button type="submit" className={styles.primary} disabled={reasonId === null || pending}>
                {pending ? t('orderCancelling') : t('orderCancelConfirm')}
              </button>
              <button type="button" className={styles.secondary} onClick={onClose} disabled={pending}>
                {t('orderCancelKeep')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className={styles.error} role="alert">
              {t('orderReasonsError')}
            </p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} onClick={onClose}>
                {t('orderCancelKeep')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
