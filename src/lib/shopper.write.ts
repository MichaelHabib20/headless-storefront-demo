import 'server-only';
import { isApiError, type Locale, type ShopperContext } from '@/sdk';
import { ensureShopperContext, forgetGuest, guestToken } from './shopper.server';

/**
 * Runs one write for the shopper (server actions only). Creates the guest session on the
 * first write, and when the backend no longer knows a guest token (expired session) starts
 * a fresh guest session and retries once. A signed-in customer's 401 is not retried.
 */
export async function withShopper<T>(locale: Locale, operation: (ctx: ShopperContext) => Promise<T>): Promise<T> {
  const ctx = await ensureShopperContext(locale);
  try {
    return await operation(ctx);
  } catch (error) {
    if (!isApiError(error) || error.kind !== 'unauthenticated' || !ctx.token || ctx.token !== (await guestToken())) throw error;
    await forgetGuest();
    return operation(await ensureShopperContext(locale));
  }
}
