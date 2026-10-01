import Link from 'next/link';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import styles from './Message.module.css';

/**
 * Shown when the store API can't be reached. With `maintenance` (the API answered 503
 * `store_unavailable`) it shows the merchant's message instead.
 */
export function StoreUnavailable({ locale, maintenance }: { locale: Locale; maintenance?: string | null }) {
  const t = translator(locale);
  return (
    <div className={`container ${styles.message}`} role="alert" data-testid={maintenance ? 'store-maintenance' : 'store-unavailable'}>
      <h1 className={styles.title}>{maintenance ? t('maintenanceTitle') : t('errorTitle')}</h1>
      <p className={styles.text}>{maintenance ?? t('errorText')}</p>
      <Link href={routes.home(locale)} className={styles.button}>
        {maintenance ? t('maintenanceRetry') : t('tryAgain')}
      </Link>
    </div>
  );
}

/** Generic full-width message block (coming soon, not found). */
export function MessageBlock({ title, text, cta }: { title: string; text?: string; cta?: { href: string; label: string } }) {
  return (
    <div className={`container ${styles.message}`}>
      <h1 className={styles.title}>{title}</h1>
      {text && <p className={styles.text}>{text}</p>}
      {cta && (
        <Link href={cta.href} className={styles.button}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
