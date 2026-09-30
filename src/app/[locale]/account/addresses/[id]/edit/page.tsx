import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { AccountPage } from '@/components/account/AccountPage';
import { AddressForm } from '@/components/account/AddressForm';
import { idFromForm } from '@/components/account/address-form';
import { loadAddressBook, loadAddressForm } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { addressReturn, addressReturnHref, routes } from '@/lib/routing';
import { saveAddressAction } from '../../actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('addressEditTitle') : undefined, robots: { index: false } };
}

/**
 * Edit one address of the book. After saving, the API may answer with a NEW id for it: the save
 * action continues with that id, so this URL (the old id) can be gone afterwards → 404.
 */
export default async function EditAddressPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, id } = await params;
  const addressId = idFromForm(id);
  if (!isLocale(locale) || !addressId) notFound();
  const next = addressReturn((await searchParams).next);
  const t = translator(locale);
  const list = routes.addresses(locale, { next });
  const back = { href: list, label: t('addressesTitle') };

  const [book, data] = await Promise.all([loadAddressBook(locale), loadAddressForm(locale)]);
  if (book.status === 'signed-out') {
    return (
      <AccountPage title={t('addressEditTitle')} back={back}>
        <AccountSignIn locale={locale} returnTo={routes.editAddress(locale, addressId, next)} />
      </AccountPage>
    );
  }
  if (book.status !== 'ok' || !data) {
    return (
      <AccountPage title={t('addressEditTitle')} back={back}>
        <AccountLoadError locale={locale} retryHref={routes.editAddress(locale, addressId, next)} />
      </AccountPage>
    );
  }
  const address = book.data.items.find((item) => item.id === addressId);
  if (!address) notFound();

  return (
    <AccountPage title={t('addressEditTitle')} back={back} testId="address-edit-page">
      <AddressForm
        locale={locale}
        form={data.form}
        locations={data.locations}
        address={address}
        next={next}
        cancelHref={addressReturnHref(locale, next) ?? list}
        action={saveAddressAction}
      />
    </AccountPage>
  );
}
