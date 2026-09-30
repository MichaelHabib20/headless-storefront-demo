import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, cancelOrder, reorder } from '@/sdk';
import { ensureShopperContext } from '@/lib/shopper.server';
import { orderFixture, reorderFixture } from '@/test/account-fixtures';
import { cancelOrderAction, reorderAction } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), cancelOrder: vi.fn(), reorder: vi.fn() }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn(), guestToken: vi.fn(async () => null), forgetGuest: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureShopperContext).mockImplementation(async (locale) => ({ locale, token: 'test-customer' }));
});

describe('cancelOrderAction', () => {
  it('cancels with the reason and note, then refreshes the pages', async () => {
    vi.mocked(cancelOrder).mockResolvedValue(orderFixture('en'));

    await expect(cancelOrderAction('en', 'mock-order-48201', 2, ' Ordered twice ')).resolves.toEqual({ ok: true, message: 'Your order was cancelled.' });
    expect(cancelOrder).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'test-customer' }, 'mock-order-48201', { reasonId: 2, note: 'Ordered twice' });
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it("409 cannot_cancel: the backend's message, and the page is refreshed with the order as it is now", async () => {
    vi.mocked(cancelOrder).mockRejectedValue(new ApiError('cannot_cancel', 409, 'This order can no longer be cancelled.'));

    await expect(cancelOrderAction('en', 'mock-order-48201', 1, null)).resolves.toEqual({ ok: false, message: 'This order can no longer be cancelled.' });
    expect(vi.mocked(cancelOrder).mock.calls[0][3]).toEqual({ reasonId: 1, note: null });
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it('refuses impossible arguments without calling the API', async () => {
    expect(await cancelOrderAction('en', '', 1, null)).toMatchObject({ ok: false });
    expect(await cancelOrderAction('en', 'x', 0, null)).toMatchObject({ ok: false });
    expect(cancelOrder).not.toHaveBeenCalled();
  });
});

describe('reorderAction', () => {
  it("answers what the API skipped and refreshes the header's cart count", async () => {
    vi.mocked(reorder).mockResolvedValue(reorderFixture('ar'));

    await expect(reorderAction('ar', 'mock-order-48200')).resolves.toEqual({ ok: true, skipped: reorderFixture('ar').skipped });
    expect(reorder).toHaveBeenCalledWith(expect.anything(), { locale: 'ar', token: 'test-customer' }, 'mock-order-48200');
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it('reports a failure without refreshing', async () => {
    vi.mocked(reorder).mockRejectedValue(new ApiError('not_found', 404, 'Not found.'));
    await expect(reorderAction('en', 'nope')).resolves.toEqual({ ok: false, message: 'Not found.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
