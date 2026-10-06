import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError } from '@/components/account/AccountStates';
import { AuthPage } from '@/components/auth/AuthPage';
import { signOutAction } from '@/lib/auth.actions';
import { loadProfile } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { loyaltyOn } from '@/lib/loyalty.server';
import { routes } from '@/lib/routing';
import { bankDetailsOn } from '@/lib/bank-details.server';
import { insuranceOn } from '@/lib/insurance.server';
import { vouchersOn } from '@/lib/vouchers.server';
import { walletOn } from '@/lib/wallet.server';

export const dynamic = 'force-dynamic';

/** The account's front page: who is signed in (from the API), the account links and sign-out. */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const [result, loyalty, wallet, vouchers, insurance, bankDetails] = await Promise.all([loadProfile(locale), loyaltyOn(locale), walletOn(locale), vouchersOn(locale), insuranceOn(locale), bankDetailsOn(locale)]);
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
          {loyalty && (
            <li>
              <Link href={routes.points(locale)}>{t('accountPointsLink')}</Link>
            </li>
          )}
          {wallet && (
            <li>
              <Link href={routes.wallet(locale)}>{t('accountWalletLink')}</Link>
            </li>
          )}
          {vouchers && (
            <li>
              <Link href={routes.myVouchers(locale)}>{t('accountVouchersLink')}</Link>
            </li>
          )}
          {insurance && (
            <li>
              <Link href={routes.insurance(locale)}>{t('accountInsuranceLink')}</Link>
            </li>
          )}
          {bankDetails && (
            <li>
              <Link href={routes.bankDetails(locale)}>{t('accountBankDetailsLink')}</Link>
            </li>
          )}
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
