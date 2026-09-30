import Link from 'next/link';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import styles from './Account.module.css';

/**
 * No shopper token (or the API refused it): nothing to show yet. Rendering never starts a guest
 * session; the shopper signs in and comes back to `returnTo`.
 */
export function AccountSignIn({ locale, returnTo }: { locale: Locale; returnTo: string }) {
  const t = translator(locale);
  return (
    <div className={styles.state} data-testid="account-sign-in">
      <h2 className={styles.stateTitle}>{t('accountSignInTitle')}</h2>
      <p className={styles.stateText}>{t('accountSignInText')}</p>
      <Link href={routes.signIn(locale, returnTo)} className={styles.primary}>
        {t('accountSignInCta')}
      </Link>
    </div>
  );
}

/** The API failed (not a missing session, not a missing record). */
export function AccountLoadError({ locale, retryHref }: { locale: Locale; retryHref: string }) {
  const t = translator(locale);
  return (
    <div className={styles.state} role="alert" data-testid="account-error">
      <p className={styles.stateText}>{t('accountLoadError')}</p>
      <Link href={retryHref} className={styles.primary}>
        {t('accountRetry')}
      </Link>
    </div>
  );
}
