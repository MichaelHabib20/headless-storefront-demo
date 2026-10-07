/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, computeCheckout, getCheckoutSettings, getPickupBranches, type ShopperContext } from '@/sdk';
import { ensureShopperContext, shopperContext } from '@/lib/shopper.server';
import { checkoutFixture, checkoutSettingsFixture, firstCheckoutFixture, pickupBranchesFixture } from '@/test/checkout-fixtures';
import CheckoutPage from './page';

vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  computeCheckout: vi.fn(),
  getCheckoutSettings: vi.fn(),
  getPickupBranches: vi.fn(),
}));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn() }));
vi.mock('./actions', () => ({ computeCheckoutAction: vi.fn(), placeOrderAction: vi.fn(), saveContactAction: vi.fn(), uploadPrescriptionAction: vi.fn() }));

const context = (locale: 'en' | 'ar', token: string | null): ShopperContext => ({ locale, token });

async function renderPage(locale: 'en' | 'ar', query: Record<string, string> = {}) {
  render(await CheckoutPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));
}

describe('checkout page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCheckoutSettings).mockResolvedValue(checkoutSettingsFixture());
    vi.mocked(getPickupBranches).mockResolvedValue(pickupBranchesFixture('en'));
  });

  it('computes the first checkout without any choice and draws it', async () => {
    const checkout = firstCheckoutFixture('en');
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(computeCheckout).mockResolvedValue(checkout);
    await renderPage('en');

    expect(computeCheckout).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'test-customer' }, {});
    expect(screen.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    expect(screen.getByTestId('checkout-total').textContent).toBe(checkout.totals.total.display);
    // the backend preselected delivery to the default address: the page shows its echo
    expect(screen.getByRole('radio', { name: /Delivery/ })).toBeChecked();
    expect(screen.getByTestId('checkout-blockers')).toHaveTextContent(checkout.blockers[0].message);
    expect(screen.getByTestId('place-order')).toBeDisabled();
  });

  it('sends the address the addresses page came back with, and nothing else from the URL', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('ar', 'test-customer'));
    vi.mocked(computeCheckout).mockResolvedValue(checkoutFixture('ar'));
    await renderPage('ar', { address: '777', paymentMethodId: '3', total: '1' });

    expect(computeCheckout).toHaveBeenCalledWith(expect.anything(), { locale: 'ar', token: 'test-customer' }, { addressId: 777 });
    expect(screen.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible();
  });

  it('ignores an address parameter that is not an id', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(computeCheckout).mockResolvedValue(checkoutFixture('en'));
    await renderPage('en', { address: '7 OR 1=1' });
    expect(computeCheckout).toHaveBeenCalledWith(expect.anything(), expect.anything(), {});
  });

  it('shows the empty cart and a sign-in link to visitors without a session, and never starts one', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('en', null));
    await renderPage('en');

    expect(computeCheckout).not.toHaveBeenCalled();
    expect(getPickupBranches).not.toHaveBeenCalled();
    expect(ensureShopperContext).not.toHaveBeenCalled();
    expect(screen.getByTestId('cart-empty')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/session/signin?returnUrl=checkout');
    expect(screen.queryByTestId('place-order')).toBeNull();
  });

  it('shows the empty cart when the API no longer accepts the token', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'expired'));
    vi.mocked(computeCheckout).mockRejectedValue(new ApiError('unauthenticated', 401, 'Please start a session first.'));
    await renderPage('en');

    expect(screen.getByTestId('cart-empty')).toBeVisible();
    expect(screen.getByTestId('checkout-sign-in-hint')).toBeVisible();
  });

  it('shows the empty cart, without the sign-in hint, when the shopper has nothing to check out', async () => {
    const empty = checkoutFixture('en');
    empty.cart.items = [];
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(computeCheckout).mockResolvedValue(empty);
    await renderPage('en');

    expect(screen.getByTestId('cart-empty')).toBeVisible();
    expect(screen.queryByTestId('checkout-sign-in-hint')).toBeNull();
    expect(screen.queryByTestId('place-order')).toBeNull();
  });

  it('still works when the pickup branches can not be loaded', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(computeCheckout).mockResolvedValue(checkoutFixture('en'));
    vi.mocked(getPickupBranches).mockRejectedValue(new ApiError('server', 500, 'Boom'));
    await renderPage('en');

    expect(screen.getByTestId('place-order')).toBeVisible();
    log.mockRestore();
  });

  it('says the store is unavailable when the checkout can not be computed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(computeCheckout).mockRejectedValue(new ApiError('server', 500, 'Something went wrong.'));
    await renderPage('en');

    expect(screen.getByRole('alert')).toHaveTextContent('The store is taking a break');
    expect(screen.queryByTestId('cart-empty')).toBeNull();
    log.mockRestore();
  });
});
