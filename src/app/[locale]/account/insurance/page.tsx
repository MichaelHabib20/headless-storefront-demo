import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { InsuranceView } from '@/components/insurance/InsuranceView';
import { translator } from '@/lib/i18n';
import { insuranceOn, loadInsurance } from '@/lib/insurance.server';
import { routes } from '@/lib/routing';
import { uploadPrescriptionFileAction } from '../../prescriptions/actions';
import { deleteInsuranceProfileAction, saveInsuranceProfileAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('insuranceTitle') : undefined, robots: { index: false } };
}

/** The customer's insurance details (the old storefront's /account/insurance, which was never reachable there). */
export default async function InsurancePage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await insuranceOn(locale))) notFound();
  const t = translator(locale);

  const insurance = await loadInsurance(locale);
  if (insurance.status === 'not-found') notFound();
  if (insurance.status !== 'ok') {
    const href = routes.insurance(locale);
    return (
      <AccountPage title={t('insuranceTitle')} testId="insurance-page">
        {insurance.status === 'signed-out' ? <AccountSignIn locale={locale} returnTo={href} /> : <AccountLoadError locale={locale} retryHref={href} />}
      </AccountPage>
    );
  }
  return (
    <AccountPage title={insurance.data.title} back={{ href: routes.account(locale), label: t('account') }} testId="insurance-page">
      <InsuranceView locale={locale} page={insurance.data} saveAction={saveInsuranceProfileAction} deleteAction={deleteInsuranceProfileAction} uploadAction={uploadPrescriptionFileAction} />
    </AccountPage>
  );
}
