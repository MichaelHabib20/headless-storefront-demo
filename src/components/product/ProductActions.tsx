'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Locale } from '@/sdk';
import { routes } from '@/lib/routing';
import { addToCartAction, toggleCompareAction, toggleWishlistAction, type ShopperActionResult } from '@/lib/shopper.actions';
import { formatQuantity, stepDown, stepUp, type QuantityLimits } from '../cart/quantity';
import { withCount } from '../shopper/labels';
import { ShopperIcon } from '../shopper/ShopperIcon';
import { useProductShopperState, useRunInOrder } from '../shopper/ShopperStateProvider';
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

/**
 * A quantity stepper next to the add button (the product page). The limits are the backend's
 * (`quantityStep`, `purchase.minQuantity` / `maxQuantity`); the backend still validates the quantity.
 * The button sets the cart line to the chosen quantity (`PUT /cart/items/{id}`), so once the product
 * is in the cart the stepper starts from the cart quantity and the button updates it.
 */
export interface QuantityPicker {
  limits: QuantityLimits;
  labels: { quantity: string; decrease: string; increase: string; update: string };
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
  /** Show a quantity stepper (product page). Without it the button adds `addQuantity` (cards). */
  quantity?: QuantityPicker;
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
 * Add to cart, wishlist and compare buttons for a product card or the product page. The starting
 * state comes from `GET /me` (ShopperStateProvider). Wishlist/compare toggle optimistically and roll
 * back when the server action fails; the action revalidates the layout, which refreshes the provider.
 */
export function ProductActions({ productId, productName, locale, canAddToCart, addQuantity, labels, quantity }: ProductActionsProps) {
  const { features, ...server } = useProductShopperState(productId);

  // Local copy so toggles can be optimistic; replaced whenever the server state changes.
  const [state, setState] = useState<ProductShopperState>(server);
  const [chosen, setChosen] = useState(server.cartQuantity || addQuantity);
  const serverKey = `${server.cartQuantity}|${server.inWishlist}|${server.inCompare}`;
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setState(server);
    setChosen(server.cartQuantity || addQuantity);
  }

  const [pending, setPending] = useState<Partial<Record<Field, number>>>({});
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const focusCartLink = useRef(false);
  const runInOrder = useRunInOrder();

  const track = (field: Field, delta: number) => setPending((current) => ({ ...current, [field]: Math.max(0, (current[field] ?? 0) + delta) }));

  async function perform({ field, change, undo, call }: Step) {
    // The cart is not optimistic: the "In cart" link appears once the backend accepted it.
    const optimistic = field !== 'cartQuantity';

    track(field, 1);
    setStatus(null);
    if (optimistic) setState((current) => ({ ...current, ...change }));

    // Writes from every card run one at a time, so two quick first clicks share one guest session.
    const result = await runInOrder(call).catch((): ShopperActionResult => ({ ok: false }));

    if (result.ok) {
      setState((current) => ({ ...current, ...change }));
      if (!optimistic) focusCartLink.current = true;
    } else if (optimistic) {
      setState((current) => ({ ...current, ...undo }));
    }
    setStatus({ text: result.message ?? labels.failed, error: !result.ok });
    track(field, -1);
  }

  const putInCart = (cartQuantity: number) =>
    perform({ field: 'cartQuantity', change: { cartQuantity }, undo: {}, call: () => addToCartAction(locale, productId, cartQuantity) });
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

  const cartLink = (className: string) => (
    <Link
      href={routes.cart(locale)}
      className={className}
      ref={(element) => {
        if (element && focusCartLink.current) {
          focusCartLink.current = false;
          element.focus();
        }
      }}
    >
      {withCount(labels.inCart, state.cartQuantity, locale)}
    </Link>
  );

  let cartControls;
  if (quantity) {
    const down = canAddToCart ? stepDown(chosen, quantity.limits) : null;
    const up = canAddToCart ? stepUp(chosen, quantity.limits) : null;
    const inCart = state.cartQuantity > 0;
    cartControls = (
      <>
        <div className={styles.stepper} role="group" aria-label={quantity.labels.quantity}>
          <button type="button" className={styles.step} aria-label={quantity.labels.decrease} disabled={down === null} onClick={() => down !== null && setChosen(down)}>
            <span aria-hidden="true">−</span>
          </button>
          <output className={styles.quantity} aria-live="polite" data-testid="product-quantity">
            {formatQuantity(chosen, locale)}
          </output>
          <button type="button" className={styles.step} aria-label={quantity.labels.increase} disabled={up === null} onClick={() => up !== null && setChosen(up)}>
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <button
          type="button"
          className={styles.add}
          disabled={!canAddToCart || (inCart && chosen === state.cartQuantity)}
          aria-disabled={Boolean(pending.cartQuantity) || undefined}
          onClick={() => putInCart(chosen)}
        >
          <Icon name="bag" size={16} />
          <span>{inCart ? quantity.labels.update : labels.addToCart}</span>
        </button>
        {inCart && cartLink(styles.cartLink)}
      </>
    );
  } else {
    cartControls =
      state.cartQuantity > 0 ? (
        cartLink(styles.inCart)
      ) : (
        <button type="button" className={styles.add} disabled={!canAddToCart} aria-disabled={Boolean(pending.cartQuantity) || undefined} onClick={() => putInCart(addQuantity)}>
          <Icon name="bag" size={16} />
          <span>{labels.addToCart}</span>
        </button>
      );
  }

  return (
    <div
      className={quantity ? `${styles.actions} ${styles.withQuantity}` : styles.actions}
      role="group"
      aria-label={productName}
      aria-busy={Object.values(pending).some(Boolean)}
    >
      {cartControls}

      {features.wishlist && (
        <button
          type="button"
          className={`${styles.toggle} ${styles.heart}`}
          aria-label={labels.wishlist}
          aria-pressed={state.inWishlist}
          aria-busy={Boolean(pending.inWishlist) || undefined}
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
          aria-busy={Boolean(pending.inCompare) || undefined}
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
