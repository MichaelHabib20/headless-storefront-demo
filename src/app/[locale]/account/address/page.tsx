import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { AccountPage } from '@/components/account/AccountPage';
import { AddressBook } from '@/components/account/AddressBook';
import { positiveIntParam } from '@/components/ui/Pagination';
import { loadAddressBook } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { addressReturn, addressReturnHref, routes } from '@/lib/routing';
import { deleteAddressAction, setDefaultAddressAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('addressesTitle') : undefined, robots: { index: false } };
}

/**
 * The address book. Reads only (never creates a guest); `?next=checkout` is kept on the add/edit
 * links so a save goes back to checkout, `?saved=<id>` announces the address just saved.
 */
export default async function AddressesPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const next = addressReturn(query.next);
  const saved = positiveIntParam(query.saved, 0) || null;
  const t = translator(locale);
  const here = routes.addresses(locale, { next });

  const result = await loadAddressBook(locale);
  const backHref = addressReturnHref(locale, next);

  return (
    <AccountPage
      title={t('addressesTitle')}
      back={backHref ? { href: backHref, label: t('addressesBackToCheckout') } : null}
      action={result.status === 'ok' ? { href: routes.newAddress(locale, next), label: t('addressesAdd') } : null}
      testId="addresses-page"
    >
      {result.status === 'ok' ? (
        <AddressBook
          items={result.data.items}
          locale={locale}
          next={next}
          savedId={saved}
          onDelete={deleteAddressAction}
          onMakeDefault={setDefaultAddressAction}
        />
      ) : result.status === 'signed-out' ? (
        <AccountSignIn locale={locale} returnTo={here} />
      ) : (
        <AccountLoadError locale={locale} retryHref={here} />
      )}
    </AccountPage>
  );
}
