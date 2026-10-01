'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { CancellationReason, Locale } from '@/sdk';
import { CancelOrderDialog } from '@/components/account/CancelOrderDialog';
import type { CancelOrderAction } from '@/components/account/types';
import { translator } from '@/lib/i18n';
import styles from './Prescriptions.module.css';

interface CancelPrescriptionProps {
  locale: Locale;
  prescriptionId: string;
  reasons: CancellationReason[] | null;
  cancelAction: CancelOrderAction;
}

/** "Cancel prescription" with the API's reasons; the page is refreshed with the API's new answer. */
export function CancelPrescription({ locale, prescriptionId, reasons, cancelAction }: CancelPrescriptionProps) {
  const t = translator(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.cancel}>
      <button ref={button} type="button" className={styles.secondary} onClick={() => setOpen(true)} data-testid="prescription-cancel">
        {t('prescriptionsCancel')}
      </button>
      {message && (
        <p className={message.ok ? styles.success : styles.error} role="status">
          {message.text}
        </p>
      )}
      {open && (
        <CancelOrderDialog
          locale={locale}
          orderId={prescriptionId}
          reasons={reasons}
          cancelAction={cancelAction}
          labels={{ title: t('prescriptionsCancelTitle'), confirm: t('prescriptionsCancelConfirm') }}
          onClose={() => {
            setOpen(false);
            button.current?.focus();
          }}
          onDone={(result) => {
            setOpen(false);
            setMessage({ ok: result.ok, text: result.message });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
