import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCart, isApiError, isLocale, type Cart, type Locale } from '@/sdk';
import { CartEmpty } from '@/components/cart/CartEmpty';
import { CartTitle } from '@/components/cart/CartTitle';
import { CartView } from '@/components/cart/CartView';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { shopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';
import { clearCart, removeItem, setQuantity } from './actions';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('cartTitle') : undefined, robots: { index: false } };
}

/**
 * The shopper's cart, or null when there is none yet: no session cookie, or a token the
 * API no longer accepts. Reading never creates a guest session (only a write does).
 */
async function loadCart(locale: Locale): Promise<Cart | null> {
  const ctx = await shopperContext(locale);
  if (!ctx.token) return null;
  try {
    return await getCart(storefrontClient(), ctx);
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return null;
    throw error;
  }
}

export default async function CartPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  let cart: Cart | null;
  try {
    cart = await loadCart(locale);
  } catch (error) {
    console.error('cart failed to load', error);
    return <StoreUnavailable locale={locale} />;
  }

  return (
    <div className={`container ${styles.page}`}>
      {/* CartView renders the heading with the item count of the cart it is showing. */}
      {cart?.items.length ? (
        <CartView cart={cart} locale={locale} setQuantityAction={setQuantity} removeItemAction={removeItem} clearCartAction={clearCart} />
      ) : (
        <>
          <CartTitle locale={locale} />
          <CartEmpty locale={locale} />
        </>
      )}
    </div>
  );
}
