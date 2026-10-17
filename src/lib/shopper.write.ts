import 'server-only';
import { isApiError, type Locale, type ShopperContext } from '@/sdk';
import { ensureShopperContext, forgetGuest, guestToken } from './shopper.server';

/**
 * Runs one write for the shopper (server actions only). Creates the guest session on the first
 * write. When the backend no longer knows the token (401) it retries once with a fresh session:
 * - a guest token (expired guest session): the guest cookie is dropped and a new guest starts
 * - a customer token (signed out on another device, expired): the SDK already dropped the customer
 *   cookies (storefront.server.ts forgetRefusedToken), so the shopper goes on as a guest
 */
export async function withShopper<T>(locale: Locale, operation: (ctx: ShopperContext) => Promise<T>): Promise<T> {
  const ctx = await ensureShopperContext(locale);
  try {
    return await operation(ctx);
  } catch (error) {
    if (!isApiError(error) || error.kind !== 'unauthenticated' || !ctx.token) throw error;
    if (ctx.token === (await guestToken())) {
      await forgetGuest();
      return operation(await ensureShopperContext(locale));
    }
    const next = await ensureShopperContext(locale);
    // still the same token: nothing was dropped, so the refusal stands (never retried as is)
    if (next.token === ctx.token) throw error;
    return operation(next);
  }
}
