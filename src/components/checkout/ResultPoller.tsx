'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import styles from './Checkout.module.css';

interface ResultPollerProps {
  locale: Locale;
  /** The backend's text for the pending state, when it sent one. */
  message: string | null;
  /** How long to wait between two questions to the backend. */
  intervalMs?: number;
  /** After this many questions the page stops asking and says so calmly. */
  maxChecks?: number;
}

/**
 * The payment is still pending: the bank has not answered the backend yet. Every few seconds the
 * page is rendered again on the server (it asks `GET /checkout/result` again — a read), and when
 * the status changes the server renders the real result instead of this component. It gives up
 * after a while; the order still completes on the backend when the bank answers.
 */
export function ResultPoller({ locale, message, intervalMs = 3000, maxChecks = 20 }: ResultPollerProps) {
  const t = translator(locale);
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const asking = checks < maxChecks;

  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => {
      router.refresh();
      setChecks((count) => count + 1);
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [asking, checks, intervalMs, router]);

  return (
    <div className={`container ${styles.result}`} data-testid="checkout-result" data-status="pending">
      <h1 className={styles.resultTitle}>{t('resultTitlePending')}</h1>
      {asking ? (
        <div role="status">
          <p className={styles.waiting}>
            <span className={styles.spinner} aria-hidden="true" />
            {message ?? t('resultTitlePending')}
          </p>
          <p className={styles.muted}>{t('resultPendingText')}</p>
        </div>
      ) : (
        <>
          <p className={styles.resultMessage} role="status" data-testid="result-still-pending">
            {t('resultStillPending')}
          </p>
          <div className={styles.resultActions}>
            <button type="button" className={styles.button} onClick={() => router.refresh()}>
              {t('resultCheckAgain')}
            </button>
            <Link href={routes.orders(locale)} className={`${styles.button} ${styles.buttonQuiet}`}>
              {t('resultOrders')}
            </Link>
            <Link href={routes.home(locale)} className={`${styles.button} ${styles.buttonQuiet}`}>
              {t('backHome')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
