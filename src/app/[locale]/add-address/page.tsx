import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { AccountPage } from '@/components/account/AccountPage';
import { AddressForm } from '@/components/account/AddressForm';
import styles from '@/components/prescriptions/Prescriptions.module.css';
import { loadAddressForm } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { customerToken } from '@/lib/session';
import { saveAddressAction } from '../account/addresses/actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('addAddressTitle') : undefined, robots: { index: false } };
}

/**
 * The old storefront's /add-address: the address step a prescription needs (blocker `add_address`).
 * The address form the store describes (`CheckoutSettings.addressForm`); after saving, back to
 * /prescriptions. Signed-in customers only.
 */
export default async function AddAddressPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const back = { href: routes.prescriptions(locale), label: t('prescriptionsPageTitle') };

  if (!(await customerToken())) {
    return (
      <AccountPage title={t('addAddressTitle')} back={back} testId="add-address-page">
        <AccountSignIn locale={locale} returnTo={routes.addAddress(locale)} />
      </AccountPage>
    );
  }

  const data = await loadAddressForm(locale);
  return (
    <AccountPage title={t('addAddressTitle')} back={back} testId="add-address-page">
      <p className={styles.intro}>{t('addAddressIntro')}</p>
      {data ? (
        <AddressForm locale={locale} form={data.form} locations={data.locations} next="prescriptions" cancelHref={routes.prescriptions(locale)} action={saveAddressAction} />
      ) : (
        <AccountLoadError locale={locale} retryHref={routes.addAddress(locale)} />
      )}
    </AccountPage>
  );
}
