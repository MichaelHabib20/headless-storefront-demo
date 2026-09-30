/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getCheckoutResult, type ShopperContext } from '@/sdk';
import { ensureShopperContext, shopperContext } from '@/lib/shopper.server';
import { checkoutResultFixture } from '@/test/checkout-fixtures';
import CheckoutResultPage from './page';

vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), getCheckoutResult: vi.fn() }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn() }));

const context = (locale: 'en' | 'ar', token: string | null): ShopperContext => ({ locale, token });

async function renderPage(locale: 'en' | 'ar', query: Record<string, string | string[]> = {}) {
  render(await CheckoutResultPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));
}

const status = () => screen.getByTestId('checkout-result').getAttribute('data-status');

describe('checkout result page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shopperContext).mockImplementation(async (locale) => context(locale, 'test-customer'));
  });

  it('asks the backend about the reference and thanks the shopper for a placed order', async () => {
    const result = checkoutResultFixture('placed', 'en');
    vi.mocked(getCheckoutResult).mockResolvedValue(result);
    await renderPage('en', { checkout: 'mock-checkout-2' });

    expect(getCheckoutResult).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'test-customer' }, 'mock-checkout-2');
    expect(status()).toBe('placed');
    expect(screen.getByRole('heading', { level: 1, name: 'Thank you for your order' })).toBeVisible();
    expect(screen.getByText(result.message!)).toBeVisible();
    expect(screen.getByTestId('result-order-number')).toHaveTextContent(result.order!.number);
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', `/en/account/orders/${result.order!.id}`);
  });

  it('trusts nothing in the URL but the reference', async () => {
    vi.mocked(getCheckoutResult).mockResolvedValue(checkoutResultFixture('failed', 'en'));
    await renderPage('en', { checkout: 'ref-1', status: 'paid', success: 'true', total: '0', order: '48211' });

    expect(getCheckoutResult).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'ref-1');
    expect(status()).toBe('failed');
    expect(screen.queryByText('Thank you for your order')).toBeNull();
    expect(screen.queryByTestId('result-order')).toBeNull();
  });

  it('shows a neutral message with a link to the orders when there is no reference', async () => {
    await renderPage('en');

    expect(getCheckoutResult).not.toHaveBeenCalled();
    expect(status()).toBe('unknown');
    expect(screen.getByRole('heading', { level: 1, name: 'We could not find this order' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/en/account/orders');
  });

  it.each([
    ['a reference the backend does not know', new ApiError('not_found', 404, 'Not found.')],
    ['a reference the backend refuses', new ApiError('validation', 422, 'Invalid.')],
    ['a session the backend no longer accepts', new ApiError('unauthenticated', 401, 'Please start a session first.')],
  ])('shows the neutral message for %s', async (_name, error) => {
    vi.mocked(getCheckoutResult).mockRejectedValue(error);
    await renderPage('ar', { checkout: 'nope' });

    expect(status()).toBe('unknown');
    expect(screen.getByRole('link', { name: 'طلباتي' })).toHaveAttribute('href', '/ar/account/orders');
  });

  it('does not ask without a session, takes the first of repeated parameters, and refuses absurd references', async () => {
    vi.mocked(shopperContext).mockResolvedValue(context('en', null));
    await renderPage('en', { checkout: 'ref-1' });
    expect(getCheckoutResult).not.toHaveBeenCalled();
    expect(ensureShopperContext).not.toHaveBeenCalled();
    expect(status()).toBe('unknown');

    vi.mocked(shopperContext).mockResolvedValue(context('en', 'test-customer'));
    vi.mocked(getCheckoutResult).mockResolvedValue(checkoutResultFixture('placed', 'en'));
    await renderPage('en', { checkout: ['ref-a', 'ref-b'] });
    expect(getCheckoutResult).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'ref-a');

    vi.mocked(getCheckoutResult).mockClear();
    await renderPage('en', { checkout: 'x'.repeat(201) });
    expect(getCheckoutResult).not.toHaveBeenCalled();
  });

  it('says the store is unavailable when the result can not be loaded', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getCheckoutResult).mockRejectedValue(new ApiError('server', 500, 'Boom'));
    await renderPage('en', { checkout: 'ref-1' });

    expect(screen.getByRole('alert')).toHaveTextContent('The store is taking a break');
    log.mockRestore();
  });
});
