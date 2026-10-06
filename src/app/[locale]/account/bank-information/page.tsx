import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { BankDetailsView } from '@/components/bank-details/BankDetailsView';
import { bankDetailsOn, loadBankDetails } from '@/lib/bank-details.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { saveBankDetailsAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('bankDetailsTitle') : undefined, robots: { index: false } };
}

/** The old storefront's /account/bank-information: where the store sends the customer's refunds. */
export default async function BankDetailsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await bankDetailsOn(locale))) notFound();
  const t = translator(locale);

  const details = await loadBankDetails(locale);
  if (details.status === 'not-found') notFound();
  if (details.status !== 'ok') {
    const href = routes.bankDetails(locale);
    return (
      <AccountPage title={t('bankDetailsTitle')} testId="bank-details-page">
        {details.status === 'signed-out' ? <AccountSignIn locale={locale} returnTo={href} /> : <AccountLoadError locale={locale} retryHref={href} />}
      </AccountPage>
    );
  }
  return (
    <AccountPage title={details.data.title} back={{ href: routes.account(locale), label: t('account') }} testId="bank-details-page">
      <BankDetailsView locale={locale} details={details.data} saveAction={saveBankDetailsAction} />
    </AccountPage>
  );
}
