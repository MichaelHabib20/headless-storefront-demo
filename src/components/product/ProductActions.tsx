'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Locale } from '@/sdk';
import { routes } from '@/lib/routing';
import { addToCartAction, toggleCompareAction, toggleWishlistAction, type ShopperActionResult } from '@/lib/shopper.actions';
import { withCount } from '../shopper/labels';
import { ShopperIcon } from '../shopper/ShopperIcon';
import { useProductShopperState } from '../shopper/ShopperStateProvider';
import type { ProductShopperState } from '../shopper/state';
import { Icon } from '../ui/Icon';
import styles from './ProductActions.module.css';

export interface ProductActionsLabels {
  addToCart: string;
  /** With `{count}`: "In cart ({count})" */
  inCart: string;
  wishlist: string;
  compare: string;
  /** Shown when the action could not reach the server at all. */
  failed: string;
}

interface ProductActionsProps {
  productId: number;
  productName: string;
  locale: Locale;
  /** `purchase.canAddToCart` — the backend decides. */
  canAddToCart: boolean;
  /** Quantity put in the cart: the backend's `purchase.minQuantity`. */
  addQuantity: number;
  labels: ProductActionsLabels;
}

type Field = keyof ProductShopperState;
type Pending = ReturnType<typeof addToCartAction>;

interface Step {
  field: Field;
  /** The new state after success (applied immediately for optimistic toggles). */
  change: Partial<ProductShopperState>;
  /** What to put back if an optimistic toggle fails. */
  undo: Partial<ProductShopperState>;
  call: () => Pending;
}

/**
 * Add to cart, wishlist and compare buttons for a product card. The starting state comes from
 * `GET /me` (ShopperStateProvider). Wishlist/compare toggle optimistically and roll back when the
 * server action fails; the action revalidates the layout, which refreshes the provider.
 */
export function ProductActions({ productId, productName, locale, canAddToCart, addQuantity, labels }: ProductActionsProps) {
  const { features, ...server } = useProductShopperState(productId);

  // Local copy so toggles can be optimistic; replaced whenever the server state changes.
  const [state, setState] = useState<ProductShopperState>(server);
  const serverKey = `${server.cartQuantity}|${server.inWishlist}|${server.inCompare}`;
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setState(server);
  }

  const [busy, setBusy] = useState<Field | null>(null);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const running = useRef(false);
  const focusCartLink = useRef(false);

  async function perform({ field, change, undo, call }: Step) {
    if (running.current) return;
    running.current = true;
    // The cart is not optimistic: the "In cart" link appears once the backend accepted it.
    const optimistic = field !== 'cartQuantity';

    setBusy(field);
    setStatus(null);
    if (optimistic) setState((current) => ({ ...current, ...change }));

    const result = await call().catch((): ShopperActionResult => ({ ok: false }));

    if (result.ok) {
      setState((current) => ({ ...current, ...change }));
      if (!optimistic) focusCartLink.current = true;
    } else if (optimistic) {
      setState((current) => ({ ...current, ...undo }));
    }
    setStatus({ text: result.message ?? labels.failed, error: !result.ok });
    setBusy(null);
    running.current = false;
  }

  const addToCart = () =>
    perform({ field: 'cartQuantity', change: { cartQuantity: addQuantity }, undo: {}, call: () => addToCartAction(locale, productId, addQuantity) });
  const toggleWishlist = () =>
    perform({
      field: 'inWishlist',
      change: { inWishlist: !state.inWishlist },
      undo: { inWishlist: state.inWishlist },
      call: () => toggleWishlistAction(locale, productId, !state.inWishlist),
    });
  const toggleCompare = () =>
    perform({
      field: 'inCompare',
      change: { inCompare: !state.inCompare },
      undo: { inCompare: state.inCompare },
      call: () => toggleCompareAction(locale, productId, !state.inCompare),
    });

  return (
    <div className={styles.actions} role="group" aria-label={productName} aria-busy={busy !== null}>
      {state.cartQuantity > 0 ? (
        <Link
          href={routes.cart(locale)}
          className={styles.inCart}
          ref={(element) => {
            if (element && focusCartLink.current) {
              focusCartLink.current = false;
              element.focus();
            }
          }}
        >
          {withCount(labels.inCart, state.cartQuantity, locale)}
        </Link>
      ) : (
        <button type="button" className={styles.add} disabled={!canAddToCart} aria-disabled={busy === 'cartQuantity' || undefined} onClick={addToCart}>
          <Icon name="bag" size={16} />
          <span>{labels.addToCart}</span>
        </button>
      )}

      {features.wishlist && (
        <button
          type="button"
          className={`${styles.toggle} ${styles.heart}`}
          aria-label={labels.wishlist}
          aria-pressed={state.inWishlist}
          aria-disabled={busy === 'inWishlist' || undefined}
          onClick={toggleWishlist}
        >
          {state.inWishlist ? <ShopperIcon name="heartFilled" size={20} /> : <Icon name="heart" size={20} />}
        </button>
      )}

      {features.compare && (
        <button
          type="button"
          className={styles.toggle}
          aria-label={labels.compare}
          aria-pressed={state.inCompare}
          aria-disabled={busy === 'inCompare' || undefined}
          onClick={toggleCompare}
        >
          <ShopperIcon name="compare" size={20} />
        </button>
      )}

      <p className={status?.error ? `${styles.status} ${styles.error}` : styles.status} role="status">
        {status?.text}
      </p>
    </div>
  );
}
