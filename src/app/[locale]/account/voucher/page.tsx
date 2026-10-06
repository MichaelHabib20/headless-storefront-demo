import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { VouchersView } from '@/components/vouchers/VouchersView';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { loadVouchers, vouchersOn } from '@/lib/vouchers.server';
import { addVoucherAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('vouchersTitle') : undefined, robots: { index: false } };
}

/** The old storefront's /account/voucher: the customer's vouchers and cashback vouchers, and adding a code. */
export default async function VouchersPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await vouchersOn(locale))) notFound();
  const t = translator(locale);

  const vouchers = await loadVouchers(locale);
  if (vouchers.status === 'not-found') notFound();
  if (vouchers.status !== 'ok') {
    const href = routes.myVouchers(locale);
    return (
      <AccountPage title={t('vouchersTitle')} testId="vouchers-page">
        {vouchers.status === 'signed-out' ? <AccountSignIn locale={locale} returnTo={href} /> : <AccountLoadError locale={locale} retryHref={href} />}
      </AccountPage>
    );
  }
  return (
    <AccountPage title={vouchers.data.title} back={{ href: routes.account(locale), label: t('account') }} testId="vouchers-page">
      <VouchersView locale={locale} vouchers={vouchers.data} addAction={addVoucherAction} />
    </AccountPage>
  );
}
