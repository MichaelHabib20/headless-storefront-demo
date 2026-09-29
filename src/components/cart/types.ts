import type { Cart, Locale } from '@/sdk';

/**
 * What every cart server action returns: the cart exactly as the backend now has it
 * (items, totals, checkout rules), or a message to show. The UI never patches totals itself.
 */
export type CartActionResult = { ok: true; cart: Cart } | { ok: false; message: string };

/** One call to the backend through a server action. */
export type CartCall = () => Promise<CartActionResult>;

export type SetQuantityAction =(locale: Locale, productId: number, quantity: number) => Promise<CartActionResult>;
export type RemoveItemAction = (locale: Locale, productId: number) => Promise<CartActionResult>;
export type ClearCartAction = (locale: Locale) => Promise<CartActionResult>;
