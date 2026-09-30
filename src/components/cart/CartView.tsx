'use client';

import { useOptimistic, useState, useTransition } from 'react';
import type { Cart, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { CartEmpty } from './CartEmpty';
import { CartLineItem } from './CartLineItem';
import { CartSummary } from './CartSummary';
import { CartTitle } from './CartTitle';
import { ClearCartButton } from './ClearCartButton';
import type { CartActionResult, CartCall, ClearCartAction, RemoveItemAction, SetQuantityAction } from './types';
import styles from './CartView.module.css';

interface CartViewProps {
  cart: Cart;
  locale: Locale;
  setQuantityAction: SetQuantityAction;
  removeItemAction: RemoveItemAction;
  clearCartAction: ClearCartAction;
}

/** productId → quantity on its way to the backend, or 'removing'. */
type InFlight = Readonly<Record<number, number | 'removing'>>;
interface Change {
  productIds: number[];
  to: number | 'removing';
}

const NOTHING_IN_FLIGHT: InFlight = Object.freeze({});

function applyChange(state: InFlight, change: Change): InFlight {
  const next: Record<number, number | 'removing'> = { ...state };
  for (const id of change.productIds) next[id] = change.to;
  return next;
}

/**
 * The interactive cart. Optimistic state covers only what the shopper just asked for (the
 * quantity number) and which lines are busy; every price, total and checkout rule is
 * replaced by the cart the API returns after each change.
 */
export function CartView({ cart: serverCart, locale, setQuantityAction, removeItemAction, clearCartAction }: CartViewProps) {
  const t = translator(locale);
  const [cart, setCart] = useState(serverCart);
  // A fresh server render (e.g. after revalidation) is the newest answer from the API.
  const [lastServerCart, setLastServerCart] = useState(serverCart);
  if (serverCart !== lastServerCart) {
    setLastServerCart(serverCart);
    setCart(serverCart);
  }

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [inFlight, markInFlight] = useOptimistic(NOTHING_IN_FLIGHT, applyChange);

  // One change at a time (controls lock while pending), so API answers can't arrive out of order.
  function update(change: Change, call: CartCall) {
    setError(null);
    startTransition(async () => {
      markInFlight(change);
      let result: CartActionResult;
      try {
        result = await call();
      } catch (cause) {
        console.error('cart update failed', cause);
        result = { ok: false, message: t('cartErrorGeneric') };
      }
      startTransition(() => {
        if (result.ok) setCart(result.cart);
        else setError(result.message);
      });
    });
  }

  function changeQuantity(productId: number, quantity: number) {
    update({ productIds: [productId], to: quantity }, () => setQuantityAction(locale, productId, quantity));
  }

  function removeLine(productId: number) {
    update({ productIds: [productId], to: 'removing' }, () => removeItemAction(locale, productId));
  }

  function clearAll() {
    const productIds = cart.items.map((item) => item.product.id);
    update({ productIds, to: 'removing' }, () => clearCartAction(locale));
  }

  if (!cart.items.length) {
    return (
      <>
        <CartTitle locale={locale} />
        <CartEmpty locale={locale} />
      </>
    );
  }

  return (
    <>
      <CartTitle locale={locale} itemCount={cart.summary.itemCount} />
      <div className={styles.layout}>
        <section className={styles.items} aria-labelledby="cart-items-heading">
          <div className={styles.listHeader}>
            <h2 id="cart-items-heading" className={styles.listTitle}>
              {t('cartItemsHeading')}
            </h2>
            <ClearCartButton locale={locale} disabled={isPending} onConfirm={clearAll} />
          </div>

          <p className="visually-hidden" role="status">
            {isPending ? t('cartUpdating') : ''}
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <ul className={styles.list}>
            {cart.items.map((item) => {
              const id = item.product.id;
              const optimistic = inFlight[id];
              return (
                <li key={id}>
                  <CartLineItem
                    item={item}
                    locale={locale}
                    quantity={typeof optimistic === 'number' ? optimistic : item.quantity}
                    pending={optimistic !== undefined}
                    disabled={isPending}
                    onQuantityChange={(quantity) => changeQuantity(id, quantity)}
                    onRemove={() => removeLine(id)}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <CartSummary cart={cart} locale={locale} pending={isPending} />
      </div>
    </>
  );
}
