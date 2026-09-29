import type { Layout, Me } from '@/sdk';

/** What a product card needs to know about the current shopper, taken from `GET /me`. */
export interface ProductShopperState {
  /** Quantity already in the cart (0 = not in the cart). */
  cartQuantity: number;
  inWishlist: boolean;
  inCompare: boolean;
}

/** Store switches that decide which card actions exist (`layout.features`). */
export type ShopperFeatures = Pick<Layout['features'], 'wishlist' | 'compare'>;

type MeLists = Pick<Me, 'cartQuantities' | 'wishlistProductIds' | 'compareProductIds'>;

/** Reads a product's state from Me. No Me (not loaded / failed) = nothing in any list. */
export function productShopperState(me: MeLists | null, productId: number): ProductShopperState {
  return {
    cartQuantity: me?.cartQuantities[String(productId)] ?? 0,
    inWishlist: me?.wishlistProductIds.includes(productId) ?? false,
    inCompare: me?.compareProductIds.includes(productId) ?? false,
  };
}
