import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, clearCart as clearCartRequest, removeCartItem, setCartItem } from '@/sdk';
import { ensureShopperContext } from '@/lib/shopper.server';
import { cartFixture, emptyCartFixture } from '@/test/fixtures';
import { clearCart, removeItem, setQuantity } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  setCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  clearCart: vi.fn(),
}));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
// guestToken → null: the token belongs to a signed-in customer, so a 401 is not retried
// (the guest retry is covered in src/lib/shopper.actions.test.ts).
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn(), guestToken: vi.fn(async () => null), forgetGuest: vi.fn() }));

describe('cart server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensureShopperContext).mockImplementation(async (locale) => ({ locale, token: 'guest-1' }));
  });

  it('sets a quantity through the SDK and returns the API cart', async () => {
    const cart = cartFixture('en');
    vi.mocked(setCartItem).mockResolvedValue(cart);

    await expect(setQuantity('en', 7346, 2)).resolves.toEqual({ ok: true, cart });
    expect(ensureShopperContext).toHaveBeenCalledWith('en');
    expect(setCartItem).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'guest-1' }, 7346, 2);
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it('removes an item and clears the cart', async () => {
    vi.mocked(removeCartItem).mockResolvedValue(cartFixture('ar'));
    vi.mocked(clearCartRequest).mockResolvedValue(emptyCartFixture('ar'));

    await expect(removeItem('ar', 36480)).resolves.toMatchObject({ ok: true });
    expect(removeCartItem).toHaveBeenCalledWith(expect.anything(), { locale: 'ar', token: 'guest-1' }, 36480);
    await expect(clearCart('ar')).resolves.toEqual({ ok: true, cart: emptyCartFixture('ar') });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it('rejects impossible arguments without calling the API', async () => {
    expect(await setQuantity('en', 7346, -1)).toEqual({ ok: false, message: 'We could not update your cart. Please try again.' });
    expect(await setQuantity('en', 7346, Number.NaN)).toMatchObject({ ok: false });
    expect(await removeItem('en', 1.5)).toMatchObject({ ok: false });
    expect(setCartItem).not.toHaveBeenCalled();
    expect(removeCartItem).not.toHaveBeenCalled();
  });

  it('passes on the backend message for a refused quantity', async () => {
    vi.mocked(setCartItem).mockRejectedValue(new ApiError('validation', 422, 'validation_failed', { quantity: ['This quantity is not allowed.'] }));
    expect(await setQuantity('en', 7346, 150)).toEqual({ ok: false, message: 'This quantity is not allowed.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('uses localized messages for session and network problems', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(removeCartItem).mockRejectedValueOnce(new ApiError('unauthenticated', 401, 'Please start a session first.'));
    expect(await removeItem('en', 7346)).toEqual({ ok: false, message: 'Your cart session has expired. Reload the page and try again.' });

    vi.mocked(clearCartRequest).mockRejectedValueOnce(new ApiError('network', 0, 'Could not reach the store.'));
    expect(await clearCart('ar')).toEqual({ ok: false, message: 'تعذر تحديث السلة. حاول مرة أخرى.' });
    log.mockRestore();
  });
});
