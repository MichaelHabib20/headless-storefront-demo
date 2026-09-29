import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/sdk';

const request = vi.fn();
const revalidatePath = vi.fn();
const ensureShopperContext = vi.fn(async (locale: string) => ({ locale, token: 'tok' }));

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock('@/lib/shopper.server', () => ({ ensureShopperContext: (locale: string) => ensureShopperContext(locale) }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: () => ({ request, get: vi.fn() }) }));

const { moveWishlistItemToCartAction, removeFromWishlistAction } = await import('./actions');

beforeEach(() => {
  request.mockReset();
  revalidatePath.mockReset();
  ensureShopperContext.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('wishlist actions', () => {
  it('removes through the SDK with the shopper token and refreshes every page', async () => {
    request.mockResolvedValue({ count: 2, productIds: [1, 2], maxItems: null });

    await expect(removeFromWishlistAction('en', 33594)).resolves.toEqual({ ok: true });
    expect(ensureShopperContext).toHaveBeenCalledWith('en');
    expect(request).toHaveBeenCalledWith('DELETE', 'wishlist/items/33594', { locale: 'en', token: 'tok' });
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it('moves an item to the cart', async () => {
    request.mockResolvedValue({});
    await expect(moveWishlistItemToCartAction('ar', 8658)).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledWith('POST', 'wishlist/items/8658/move-to-cart', { locale: 'ar', token: 'tok' });
  });

  it("returns the backend's localized message for errors the shopper can act on", async () => {
    request.mockRejectedValue(new ApiError('quantity_not_allowed', 422, 'هذه الكمية غير مسموح بها.'));
    await expect(moveWishlistItemToCartAction('ar', 8658)).resolves.toEqual({ ok: false, message: 'هذه الكمية غير مسموح بها.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic localized message for anything else', async () => {
    request.mockRejectedValue(new ApiError('network', 0, 'Could not reach the store.'));
    await expect(removeFromWishlistAction('ar', 1)).resolves.toEqual({ ok: false, message: 'تعذر تحديث المفضلة. حاول مرة أخرى.' });

    request.mockRejectedValue(new Error('boom'));
    await expect(removeFromWishlistAction('en', 1)).resolves.toEqual({ ok: false, message: 'We could not update your wishlist. Please try again.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects bad input without calling the API', async () => {
    await expect(removeFromWishlistAction('en', 1.5)).resolves.toMatchObject({ ok: false });
    await expect(removeFromWishlistAction('en', -3)).resolves.toMatchObject({ ok: false });
    await expect(removeFromWishlistAction('xx' as 'en', 3)).resolves.toMatchObject({ ok: false });
    await expect(removeFromWishlistAction('en', '3' as unknown as number)).resolves.toMatchObject({ ok: false });
    expect(request).not.toHaveBeenCalled();
    expect(ensureShopperContext).not.toHaveBeenCalled();
  });
});
