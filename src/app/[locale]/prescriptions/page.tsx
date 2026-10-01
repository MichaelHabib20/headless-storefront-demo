import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { PrescriptionForm } from '@/components/prescriptions/PrescriptionForm';
import { PrescriptionsList } from '@/components/prescriptions/PrescriptionsList';
import styles from '@/components/prescriptions/Prescriptions.module.css';
import { translator } from '@/lib/i18n';
import { loadPrescriptionCancellationReasons, loadPrescriptionForm, loadPrescriptions } from '@/lib/prescriptions.server';
import { routes } from '@/lib/routing';
import { loadLayout } from '@/lib/storefront.server';
import { cancelPrescriptionAction, sendPrescriptionAction, uploadPrescriptionFileAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The page exists only while the store takes prescriptions (`Layout.features.prescriptions`). */
async function prescriptionsOn(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.prescriptions);
  } catch {
    return false;
  }
}

function pageOf(params: Record<string, string | string[] | undefined>): number {
  const raw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('prescriptionsPageTitle') : undefined, robots: { index: false } };
}

/**
 * The old storefront's /prescriptions: send a prescription on the form the backend describes, and
 * follow and cancel the ones sent. Signed-in customers only (a guest is asked to sign in, and no
 * guest session is created). Reading never writes.
 */
export default async function PrescriptionsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await prescriptionsOn(locale))) notFound();
  const t = translator(locale);
  const page = pageOf(await searchParams);

  const form = await loadPrescriptionForm(locale);
  if (form.status === 'not-found') notFound();
  if (form.status === 'signed-out') {
    return (
      <AccountPage title={t('prescriptionsPageTitle')} testId="prescriptions-page">
        <AccountSignIn locale={locale} returnTo={routes.prescriptions(locale)} />
      </AccountPage>
    );
  }
  if (form.status === 'error') {
    return (
      <AccountPage title={t('prescriptionsPageTitle')} testId="prescriptions-page">
        <AccountLoadError locale={locale} retryHref={routes.prescriptions(locale, page)} />
      </AccountPage>
    );
  }

  const [list, reasons] = await Promise.all([loadPrescriptions(locale, page), loadPrescriptionCancellationReasons(locale)]);
  return (
    <AccountPage title={form.data.title} testId="prescriptions-page">
      <div className={styles.layout}>
        <PrescriptionForm locale={locale} form={form.data} sendAction={sendPrescriptionAction} uploadAction={uploadPrescriptionFileAction} />
        <section aria-labelledby="prescriptions-list-title" className={styles.form}>
          <h2 id="prescriptions-list-title" className={styles.cardTitle}>
            {t('prescriptionsListTitle')}
          </h2>
          {list.status === 'ok' ? (
            <PrescriptionsList locale={locale} page={list.data} reasons={reasons} cancelAction={cancelPrescriptionAction} />
          ) : (
            <p className={styles.error} role="alert">
              {t('prescriptionsLoadError')}
            </p>
          )}
        </section>
      </div>
    </AccountPage>
  );
}
