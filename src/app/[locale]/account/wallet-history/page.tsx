import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { WalletView } from '@/components/wallet/WalletView';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { loadWallet, walletOn } from '@/lib/wallet.server';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageOf(params: Record<string, string | string[] | undefined>): number {
  const raw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('walletTitle') : undefined, robots: { index: false } };
}

/** The old storefront's /account/wallet-history: the balance and its history (customers only; 404 while the store has no wallet). */
export default async function WalletPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await walletOn(locale))) notFound();
  const t = translator(locale);
  const page = pageOf(await searchParams);

  const wallet = await loadWallet(locale, page);
  if (wallet.status === 'not-found') notFound();
  if (wallet.status !== 'ok') {
    const href = routes.wallet(locale, page);
    return (
      <AccountPage title={t('walletTitle')} testId="wallet-page">
        {wallet.status === 'signed-out' ? <AccountSignIn locale={locale} returnTo={href} /> : <AccountLoadError locale={locale} retryHref={href} />}
      </AccountPage>
    );
  }
  return (
    <AccountPage title={wallet.data.title} back={{ href: routes.account(locale), label: t('account') }} testId="wallet-page">
      <WalletView locale={locale} wallet={wallet.data} />
    </AccountPage>
  );
}
