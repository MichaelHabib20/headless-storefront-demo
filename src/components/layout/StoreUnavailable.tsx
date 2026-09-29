import Link from 'next/link';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import styles from './Message.module.css';

/** Shown when the store API can't be reached. */
export function StoreUnavailable({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <div className={`container ${styles.message}`} role="alert">
      <h1 className={styles.title}>{t('errorTitle')}</h1>
      <p className={styles.text}>{t('errorText')}</p>
      <Link href={routes.home(locale)} className={styles.button}>
        {t('tryAgain')}
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
