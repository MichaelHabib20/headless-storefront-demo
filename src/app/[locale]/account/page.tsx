import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError } from '@/components/account/AccountStates';
import { AuthPage } from '@/components/auth/AuthPage';
import { signOutAction } from '@/lib/auth.actions';
import { loadProfile } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

/** The account's front page: who is signed in (from the API), the account links and sign-out. */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const result = await loadProfile(locale);
  if (result.status === 'signed-out') redirect(routes.signIn(locale));

  if (result.status !== 'ok') {
    return (
      <AuthPage title={t('accountOverview')} testId="account-page">
        <AccountLoadError locale={locale} retryHref={routes.account(locale)} />
      </AuthPage>
    );
  }
  const { customer } = result.data;

  return (
    <AuthPage title={`${customer.firstName} ${customer.lastName}`.trim()} lead={t('accountSignedInAs')} testId="account-page">
      <nav aria-label={t('account')} data-testid="account-links">
        <ul>
          <li>
            <Link href={routes.profile(locale)}>{t('accountProfileLink')}</Link>
          </li>
          <li>
            <Link href={routes.orders(locale)}>{t('accountOrdersLink')}</Link>
          </li>
          <li>
            <Link href={routes.addresses(locale)}>{t('accountAddressesLink')}</Link>
          </li>
          <li>
            <Link href={routes.notifications(locale)}>{t('accountNotificationsLink')}</Link>
          </li>
          <li>
            <Link href={routes.changePassword(locale)}>{t('accountPasswordLink')}</Link>
          </li>
        </ul>
      </nav>
      <dl>
        <dt>{t('authCompleteEmail')}</dt>
        <dd>{customer.email ?? '–'}</dd>
        <dt>{t('authCompletePhone')}</dt>
        <dd className="status-row">
          <span>{customer.phone ?? '–'}</span>
          {customer.phone && <span className={customer.phoneVerified ? 'badge' : 'badge badge-warn'}>{customer.phoneVerified ? t('profileVerified') : t('profileNotVerified')}</span>}
        </dd>
      </dl>
      <form action={signOutAction.bind(null, locale)}>
        <button type="submit" data-testid="sign-out">
          {t('accountSignOut')}
        </button>
      </form>
    </AuthPage>
  );
}
