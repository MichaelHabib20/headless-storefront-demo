import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, writeReview } from '@/sdk';
import { ensureShopperContext } from '@/lib/shopper.server';
import { writeReviewAction } from './reviews.actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), writeReview: vi.fn() }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn(), guestToken: vi.fn(async () => null), forgetGuest: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureShopperContext).mockImplementation(async (locale) => ({ locale, token: 'test-customer' }));
});

describe('writeReviewAction', () => {
  it("sends the review and answers the backend's thank-you text", async () => {
    vi.mocked(writeReview).mockResolvedValue({ message: 'Thank you! Your review will show once it is approved.' });

    await expect(writeReviewAction('en', { productId: 9822, rating: 5, comment: '  Lovely  ', orderId: 'mock-order-48200' })).resolves.toEqual({
      ok: true,
      message: 'Thank you! Your review will show once it is approved.',
    });
    expect(writeReview).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'test-customer' }, { productId: 9822, rating: 5, comment: 'Lovely', orderId: 'mock-order-48200' });
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it("422: the backend's message and field errors", async () => {
    vi.mocked(writeReview).mockRejectedValue(new ApiError('validation', 422, 'Please check the highlighted fields.', { orderId: ['Choose one of your delivered orders to review this product.'] }));
    await expect(writeReviewAction('en', { productId: 9822, rating: 4, comment: 'ok' })).resolves.toEqual({
      ok: false,
      message: 'Please check the highlighted fields.',
      fieldErrors: { orderId: 'Choose one of your delivered orders to review this product.' },
    });
    expect(vi.mocked(writeReview).mock.calls[0][2]).toEqual({ productId: 9822, rating: 4, comment: 'ok', orderId: null });
  });

  it('refuses impossible input without calling the API, in the shopper language', async () => {
    expect(await writeReviewAction('ar', { productId: 9822, rating: 0, comment: 'x' })).toEqual({ ok: false, message: 'تعذر إرسال تقييمك. حاول مرة أخرى.' });
    expect(await writeReviewAction('en', { productId: 9822, rating: 3, comment: '   ' })).toMatchObject({ ok: false });
    expect(writeReview).not.toHaveBeenCalled();
  });
});
