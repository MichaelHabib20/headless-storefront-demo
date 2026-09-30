/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getCart, type ShopperContext } from '@/sdk';
import { ensureShopperContext, shopperContext } from '@/lib/shopper.server';
import { cartFixture } from '@/test/fixtures';
import CartPage from './page';

vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), getCart: vi.fn() }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn() }));
vi.mock('./actions', () => ({ setQuantity: vi.fn(), removeItem: vi.fn(), clearCart: vi.fn() }));

const context = (locale: 'en' | 'ar', token: string | null): ShopperContext => ({ locale, token });

async function renderPage(locale: 'en' | 'ar') {
  render(await CartPage({ params: Promise.resolve({ locale }) }));
}

describe('cart page', () => {
  beforeEach(() => {
    vi.mocked(getCart).mockReset();
    vi.mocked(shopperContext).mockReset();
  });

  it('shows the cart of a shopper with a session', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(getCart).mockResolvedValue(cartFixture('en'));
    await renderPage('en');

    expect(getCart).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'test-customer' });
    expect(screen.getByRole('heading', { level: 1, name: 'Shopping cart' })).toBeVisible();
    expect(screen.getAllByTestId('cart-line')).toHaveLength(2);
    expect(screen.getByTestId('cart-total').textContent).toBe(cartFixture('en').summary.total.display);
  });

  it('shows the empty cart to visitors without a session and never starts one', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('en', null));
    await renderPage('en');

    expect(getCart).not.toHaveBeenCalled();
    expect(ensureShopperContext).not.toHaveBeenCalled();
    expect(screen.getByTestId('cart-empty')).toBeVisible();
  });

  it('shows the empty cart when the API no longer accepts the token', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('ar', 'expired'));
    vi.mocked(getCart).mockRejectedValue(new ApiError('unauthenticated', 401, 'يرجى بدء جلسة أولاً.'));
    await renderPage('ar');

    expect(screen.getByRole('heading', { level: 1, name: 'سلة التسوق' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'سلة التسوق فارغة' })).toBeVisible();
  });

  it('says the store is unavailable when the API is down', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(getCart).mockRejectedValue(new ApiError('server', 500, 'Something went wrong.'));
    await renderPage('en');

    expect(screen.getByRole('alert')).toHaveTextContent('The store is taking a break');
    expect(screen.queryByTestId('cart-empty')).toBeNull();
    log.mockRestore();
  });
});
