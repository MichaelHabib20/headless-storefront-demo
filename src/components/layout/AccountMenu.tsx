import Link from 'next/link';
import type { Layout, Locale, Me } from '@/sdk';
import { signOutAction } from '@/lib/auth.actions';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Icon } from '../ui/Icon';
import styles from './AccountMenu.module.css';

interface AccountMenuProps {
  locale: Locale;
  /** `GET /me` of this request; null when it could not be loaded (the menu then offers sign-in). */
  me: Me | null | undefined;
  features: Pick<Layout['features'], 'signup' | 'notifications'>;
}

/**
 * The header's account dropdown (a `<details>` element: works without JavaScript). Signed in: the
 * customer's name from `Me.customer` and the links to the account pages plus sign-out (a server
 * action → `POST /auth/sign-out` → cookies cleared). Anonymous or guest: sign in, and create an
 * account when the store allows sign-ups (`features.signup`).
 */
export function AccountMenu({ locale, me, features }: AccountMenuProps) {
  const t = translator(locale);
  const customer = me?.authenticated && !me.isGuest && me.customer ? me.customer : null;
  const name = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : '';

  return (
    <details className={styles.menu} data-testid="account-menu">
      <summary className={styles.trigger} aria-label={t('accountMenu')} data-testid="account-menu-trigger">
        <Icon name="user" />
        {customer && <span className={styles.name}>{customer.firstName}</span>}
      </summary>
      <div className={styles.panel}>
        {customer ? (
          <>
            <p className={styles.signedIn}>
              <span className={styles.muted}>{t('accountSignedInAs')}</span>
              <strong data-testid="account-menu-name">{name}</strong>
            </p>
            <Link href={routes.account(locale)} className={styles.link} aria-label={t('account')}>
              {t('accountOverview')}
            </Link>
            <Link href={routes.profile(locale)} className={styles.link}>
              {t('accountProfileLink')}
            </Link>
            <Link href={routes.orders(locale)} className={styles.link}>
              {t('accountOrdersLink')}
            </Link>
            <Link href={routes.addresses(locale)} className={styles.link}>
              {t('accountAddressesLink')}
            </Link>
            {features.notifications && (
              <Link href={routes.notifications(locale)} className={styles.link}>
                {t('accountNotificationsLink')}
              </Link>
            )}
            <Link href={routes.changePassword(locale)} className={styles.link}>
              {t('accountPasswordLink')}
            </Link>
            <form action={signOutAction.bind(null, locale)} className={styles.signOut}>
              <button type="submit" className={styles.signOutButton} data-testid="sign-out">
                {t('accountSignOut')}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href={routes.signIn(locale)} className={styles.primary} data-testid="menu-sign-in">
              {t('accountSignIn')}
            </Link>
            {features.signup && (
              <Link href={routes.signUp(locale)} className={styles.link} data-testid="menu-sign-up">
                {t('accountCreate')}
              </Link>
            )}
          </>
        )}
      </div>
    </details>
  );
}
