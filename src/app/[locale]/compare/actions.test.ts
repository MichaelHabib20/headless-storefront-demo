import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/sdk';

const request = vi.fn();
const revalidatePath = vi.fn();
const ensureShopperContext = vi.fn(async (locale: string) => ({ locale, token: 'tok' }));

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock('@/lib/shopper.server', () => ({ ensureShopperContext: (locale: string) => ensureShopperContext(locale) }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: () => ({ request, get: vi.fn() }) }));

const { removeFromCompareAction } = await import('./actions');

beforeEach(() => {
  request.mockReset();
  revalidatePath.mockReset();
  ensureShopperContext.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('compare actions', () => {
  it('removes through the SDK with the shopper token and refreshes every page', async () => {
    request.mockResolvedValue({ count: 1, productIds: [8412], maxItems: 4 });

    await expect(removeFromCompareAction('en', 36480)).resolves.toEqual({ ok: true });
    expect(ensureShopperContext).toHaveBeenCalledWith('en');
    expect(request).toHaveBeenCalledWith('DELETE', 'compare/items/36480', { locale: 'en', token: 'tok' });
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it("returns the backend's localized message for errors the shopper can act on", async () => {
    request.mockRejectedValue(new ApiError('not_found', 404, 'غير موجود.'));
    await expect(removeFromCompareAction('ar', 1)).resolves.toEqual({ ok: false, message: 'غير موجود.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic localized message for anything else', async () => {
    request.mockRejectedValue(new ApiError('server', 500, 'Something went wrong on our side.'));
    await expect(removeFromCompareAction('ar', 1)).resolves.toEqual({ ok: false, message: 'تعذر تحديث المقارنة. حاول مرة أخرى.' });
    await expect(removeFromCompareAction('en', 1)).resolves.toEqual({ ok: false, message: 'We could not update the comparison. Please try again.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects bad input without calling the API', async () => {
    await expect(removeFromCompareAction('en', 0)).resolves.toMatchObject({ ok: false });
    await expect(removeFromCompareAction('fr' as 'en', 5)).resolves.toMatchObject({ ok: false });
    expect(request).not.toHaveBeenCalled();
  });
});
