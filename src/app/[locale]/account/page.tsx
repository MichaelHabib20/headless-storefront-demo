import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLinks } from '@/components/account/AccountLinks';
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

/** Its own title like every other account page ("My account - <store>"), not the bare store name. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('accountOverview'), robots: { index: false } } : {};
}

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
    <AuthPage title={`${customer.firstName} ${customer.lastName}`.trim()} lead={t('accountSignedInAs')} testId="account-page" wide>
      <AccountLinks
        label={t('account')}
        links={[
          { href: routes.profile(locale), label: t('accountProfileLink'), kind: 'person' },
          { href: routes.orders(locale), label: t('accountOrdersLink'), kind: 'history' },
          { href: routes.addresses(locale), label: t('accountAddressesLink'), kind: 'location' },
          { href: routes.notifications(locale), label: t('accountNotificationsLink'), kind: 'notifications' },
          ...(loyalty ? [{ href: routes.points(locale), label: t('accountPointsLink'), kind: 'points' as const }] : []),
          ...(wallet ? [{ href: routes.wallet(locale), label: t('accountWalletLink'), kind: 'wallet' as const }] : []),
          ...(vouchers ? [{ href: routes.myVouchers(locale), label: t('accountVouchersLink'), kind: 'voucher' as const }] : []),
          ...(insurance ? [{ href: routes.insurance(locale), label: t('accountInsuranceLink'), kind: 'insurance' as const }] : []),
          ...(bankDetails ? [{ href: routes.bankDetails(locale), label: t('accountBankDetailsLink'), kind: 'bank' as const }] : []),
          { href: routes.changePassword(locale), label: t('accountPasswordLink'), kind: 'lock' },
        ]}
      />
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
