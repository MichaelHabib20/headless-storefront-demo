import type { Cart, Checkout } from '@/sdk';

type MinimumOrder = NonNullable<Cart['checkout']['minimumOrder']>;

/** `missing` codes that mean the delivery address or the pickup branch is not chosen yet. */
const NOT_CHOSEN = new Set(['fulfilment', 'address', 'branch']);
const BLOCKER = 'minimum_order';

/**
 * Which minimum-order verdict the checkout summary shows. Both verdicts are the backend's: the
 * storefront only picks one, it never compares amounts.
 *
 * - The checkout's `minimum_order` blocker → not reached (the checkout's own numbers).
 * - No address or branch chosen yet → the cart's verdict, the same one the cart page shows.
 *   A store whose minimum includes the delivery fee gives no checkout verdict before the
 *   address or branch is known, so a missing blocker there does not mean "reached".
 * - Otherwise → reached.
 *
 * Null when the store has no minimum.
 */
export function checkoutMinimumOrder(checkout: Checkout): { minimumOrder: MinimumOrder; reached: boolean } | null {
  const own = checkout.minimumOrder;
  if (!own) return null;
  if (checkout.blockers.some((blocker) => blocker.code === BLOCKER)) return { minimumOrder: own, reached: false };

  const cart = checkout.cart.checkout;
  const undecided = checkout.missing.some((notice) => NOT_CHOSEN.has(notice.code));
  if (undecided && cart.minimumOrder && cart.blockers.some((blocker) => blocker.code === BLOCKER)) {
    return { minimumOrder: cart.minimumOrder, reached: false };
  }
  return { minimumOrder: own, reached: true };
}
