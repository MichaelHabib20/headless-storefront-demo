'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import type { CancellationReason, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { CancelOrderDialog } from './CancelOrderDialog';
import { keepReorderNotice } from './reorder-notice';
import type { CancelOrderAction, ReorderAction, ReorderActionResult } from './types';
import styles from './Account.module.css';

interface OrderActionsProps {
  locale: Locale;
  orderId: string;
  /** `order.actions` — the ONLY switches for these buttons. */
  canCancel: boolean;
  canReorder: boolean;
  reasons: CancellationReason[] | null;
  cancelAction: CancelOrderAction;
  reorderAction: ReorderAction;
}

type Status = { tone: 'success' | 'error'; text: string };

/**
 * "Cancel order" and "Order again", shown only when the API allows them. After a cancel the
 * server action refreshes the page, so the status and the buttons are the API's new answer; the
 * message stays here (this component is always rendered, even when no button is left).
 */
export function OrderActions({ locale, orderId, canCancel, canReorder, reasons, cancelAction, reorderAction }: OrderActionsProps) {
  const t = translator(locale);
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [reordering, startReorder] = useTransition();
  const cancelButton = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  function cancelled(result: { ok: boolean; message: string }) {
    setDialogOpen(false);
    setStatus({ tone: result.ok ? 'success' : 'error', text: result.message });
    // The cancel button is gone now: move focus to the result.
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  function orderAgain() {
    setStatus(null);
    startReorder(async () => {
      let result: ReorderActionResult;
      try {
        result = await reorderAction(locale, orderId);
      } catch {
        result = { ok: false, message: t('orderActionError') };
      }
      if (!result.ok) {
        setStatus({ tone: 'error', text: result.message });
        return;
      }
      keepReorderNotice(result.skipped);
      router.push(routes.cart(locale));
    });
  }

  return (
    <section className={styles.actions} aria-label={t('orderActions')} data-testid="order-actions">
      <div ref={statusRef} tabIndex={-1} className={styles.status} aria-live="polite" data-testid="order-actions-status">
        {status && (
          <p className={status.tone === 'error' ? styles.error : styles.success} role={status.tone === 'error' ? 'alert' : undefined}>
            {status.text}
          </p>
        )}
        {reordering && <p className="visually-hidden">{t('orderReordering')}</p>}
      </div>

      {canReorder && (
        <button type="button" className={styles.primary} onClick={orderAgain} disabled={reordering} aria-busy={reordering || undefined}>
          {reordering ? t('orderReordering') : t('orderReorder')}
        </button>
      )}
      {canCancel && (
        <button ref={cancelButton} type="button" className={styles.secondary} onClick={() => setDialogOpen(true)} aria-haspopup="dialog">
          {t('orderCancel')}
        </button>
      )}

      {dialogOpen && (
        <CancelOrderDialog
          locale={locale}
          orderId={orderId}
          reasons={reasons}
          cancelAction={cancelAction}
          onDone={cancelled}
          onClose={() => {
            setDialogOpen(false);
            cancelButton.current?.focus();
          }}
        />
      )}
    </section>
  );
}
