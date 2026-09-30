import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { AccountPage } from '@/components/account/AccountPage';
import { AddressForm } from '@/components/account/AddressForm';
import { hasShopperToken, loadAddressForm } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { addressReturn, addressReturnHref, routes } from '@/lib/routing';
import { saveAddressAction } from '../actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('addressNewTitle') : undefined, robots: { index: false } };
}

/** A new address, on the form the store describes (`CheckoutSettings.addressForm` + `GET /locations`). */
export default async function NewAddressPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const next = addressReturn((await searchParams).next);
  const t = translator(locale);
  const list = routes.addresses(locale, { next });

  if (!(await hasShopperToken(locale))) {
    return (
      <AccountPage title={t('addressNewTitle')} back={{ href: list, label: t('addressesTitle') }}>
        <AccountSignIn locale={locale} returnTo={routes.newAddress(locale, next)} />
      </AccountPage>
    );
  }

  const data = await loadAddressForm(locale);
  return (
    <AccountPage title={t('addressNewTitle')} back={{ href: list, label: t('addressesTitle') }} testId="address-new-page">
      {data ? (
        <AddressForm
          locale={locale}
          form={data.form}
          locations={data.locations}
          next={next}
          cancelHref={addressReturnHref(locale, next) ?? list}
          action={saveAddressAction}
        />
      ) : (
        <AccountLoadError locale={locale} retryHref={routes.newAddress(locale, next)} />
      )}
    </AccountPage>
  );
}
