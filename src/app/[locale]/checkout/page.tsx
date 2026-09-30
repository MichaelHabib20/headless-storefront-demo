import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  computeCheckout,
  getCheckoutSettings,
  getPickupBranches,
  isApiError,
  isLocale,
  type Checkout,
  type CheckoutSelections,
  type CheckoutSettings,
  type Locale,
  type PickupBranch,
} from '@/sdk';
import { CartEmpty } from '@/components/cart/CartEmpty';
import { CheckoutView } from '@/components/checkout/CheckoutView';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { shopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';
import { computeCheckoutAction, placeOrderAction, saveContactAction, uploadPrescriptionAction } from './actions';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface Loaded {
  checkout: Checkout;
  settings: CheckoutSettings;
  branches: PickupBranch[];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('checkoutTitle') : undefined, robots: { index: false } };
}

/**
 * The first checkout, or null when there is no shopper yet (no session cookie, or a token the
 * API no longer accepts). Computing a checkout never writes, and opening the page never starts
 * a guest session: a visitor without a token has no cart to check out.
 */
async function loadCheckout(locale: Locale, selections: CheckoutSelections): Promise<Loaded | null> {
  const ctx = await shopperContext(locale);
  if (!ctx.token) return null;
  const client = storefrontClient();
  try {
    const [checkout, settings, branches] = await Promise.all([
      computeCheckout(client, ctx, selections),
      getCheckoutSettings(client, locale),
      // The list is only drawn when the shopper picks pickup: checkout still works without it.
      getPickupBranches(client, ctx).catch((error: unknown) => {
        if (isApiError(error) && error.kind === 'unauthenticated') throw error;
        console.error('pickup branches failed to load', error);
        return [] as PickupBranch[];
      }),
    ]);
    return { checkout, settings, branches };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return null;
    throw error;
  }
}

/**
 * The first call sends no choices (the backend may preselect). One exception: the addresses
 * page sends the shopper back with `?address=<id>` for the address they just added or picked.
 */
function firstSelections(query: Record<string, string | string[] | undefined>): CheckoutSelections {
  const address = typeof query.address === 'string' && /^\d{1,15}$/.test(query.address) ? Number(query.address) : null;
  return address ? { addressId: address } : {};
}

export default async function CheckoutPage({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  let loaded: Loaded | null;
  try {
    loaded = await loadCheckout(locale, firstSelections((await searchParams) ?? {}));
  } catch (error) {
    console.error('checkout failed to load', error);
    return <StoreUnavailable locale={locale} />;
  }

  const t = translator(locale);
  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>{t('checkoutTitle')}</h1>
      {loaded?.checkout.cart.items.length ? (
        <CheckoutView
          checkout={loaded.checkout}
          settings={loaded.settings}
          branches={loaded.branches}
          locale={locale}
          attemptKey={randomUUID()}
          computeAction={computeCheckoutAction}
          saveContactAction={saveContactAction}
          uploadAction={uploadPrescriptionAction}
          placeAction={placeOrderAction}
        />
      ) : (
        <>
          <CartEmpty locale={locale} />
          {!loaded && (
            <p className={styles.signIn} data-testid="checkout-sign-in-hint">
              {t('checkoutSignInHint')} <Link href={`${routes.signIn(locale)}?next=checkout`}>{t('checkoutSignIn')}</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
