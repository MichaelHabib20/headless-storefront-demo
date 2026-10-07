/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasShopperToken, loadAddressBook, loadAddressForm, loadCancellationReasons, loadOrder, loadOrders } from '@/lib/account.server';
import { ensureShopperContext } from '@/lib/shopper.server';
import { addressesFixture, cancellationReasonsFixture, checkoutSettingsFixture, deliveredOrderFixture, locationsFixture, orderFixture, ordersFixture } from '@/test/account-fixtures';
import EditAddressPage from './address/edit/[id]/page';
import NewAddressPage from './address/add/page';
import AddressesPage from './address/page';
import OrderPage from './order-history/[id]/page';
import OrdersPage from './order-history/page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en',
}));
vi.mock('@/lib/account.server', () => ({
  loadAddressBook: vi.fn(),
  loadAddressForm: vi.fn(),
  loadOrders: vi.fn(),
  loadOrder: vi.fn(),
  loadCancellationReasons: vi.fn(),
  hasShopperToken: vi.fn(),
}));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn() }));
vi.mock('./address/actions', () => ({ saveAddressAction: vi.fn(), deleteAddressAction: vi.fn(), setDefaultAddressAction: vi.fn() }));
vi.mock('./order-history/actions', () => ({ cancelOrderAction: vi.fn(), reorderAction: vi.fn(), rateOrderAction: vi.fn() }));
vi.mock('@/lib/reviews.actions', () => ({ writeReviewAction: vi.fn() }));

const params = <T extends object>(value: T) => Promise.resolve(value);
const query = (value: Record<string, string> = {}) => Promise.resolve(value);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadAddressForm).mockResolvedValue({ form: checkoutSettingsFixture('en').addressForm, locations: locationsFixture('en') });
});

describe('who may see the account pages', () => {
  it('asks visitors without a session to sign in and come back, without starting a guest session', async () => {
    vi.mocked(loadOrders).mockResolvedValue({ status: 'signed-out' });
    render(await OrdersPage({ params: params({ locale: 'en' }), searchParams: query({ page: '2' }) }));

    expect(screen.getByTestId('account-sign-in')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/session/signin?returnUrl=%2Fen%2Faccount%2Forder-history%3Fpage%3D2');
    expect(ensureShopperContext).not.toHaveBeenCalled();
  });

  it('does the same on the address pages (Arabic)', async () => {
    vi.mocked(loadAddressBook).mockResolvedValue({ status: 'signed-out' });
    render(await AddressesPage({ params: params({ locale: 'ar' }), searchParams: query({ next: 'checkout' }) }));
    expect(screen.getByRole('link', { name: 'تسجيل الدخول' })).toHaveAttribute('href', '/ar/session/signin?returnUrl=%2Far%2Faccount%2Faddress%3Fnext%3Dcheckout');
    expect(screen.queryByRole('link', { name: 'إضافة عنوان جديد' })).toBeNull();

    vi.mocked(hasShopperToken).mockResolvedValue(false);
    render(await NewAddressPage({ params: params({ locale: 'en' }), searchParams: query() }));
    expect(screen.getAllByTestId('account-sign-in')).toHaveLength(2);
    expect(loadAddressForm).not.toHaveBeenCalled();
  });

  it('shows an error block when the API fails', async () => {
    vi.mocked(loadOrders).mockResolvedValue({ status: 'error' });
    render(await OrdersPage({ params: params({ locale: 'en' }), searchParams: query() }));
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this page.');
  });
});

describe('address pages', () => {
  it('lists the address book, with the way back to checkout for ?next=checkout', async () => {
    vi.mocked(loadAddressBook).mockResolvedValue({ status: 'ok', data: addressesFixture('en') });
    render(await AddressesPage({ params: params({ locale: 'en' }), searchParams: query({ next: 'checkout', saved: '501' }) }));

    expect(screen.getByRole('heading', { level: 1, name: 'My addresses' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to checkout/ })).toHaveAttribute('href', '/en/checkout');
    expect(screen.getByRole('link', { name: 'Add a new address' })).toHaveAttribute('href', '/en/account/address/add?next=checkout');
    expect(screen.getAllByTestId('address')).toHaveLength(2);
    expect(screen.getByTestId('addresses-status')).toHaveTextContent('The address was saved.');
  });

  it('ignores any other return page', async () => {
    vi.mocked(loadAddressBook).mockResolvedValue({ status: 'ok', data: addressesFixture('en') });
    render(await AddressesPage({ params: params({ locale: 'en' }), searchParams: query({ next: 'https://evil.test' }) }));
    expect(screen.queryByRole('link', { name: /Back to checkout/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Add a new address' })).toHaveAttribute('href', '/en/account/address/add');
  });

  it('draws the new address form from the API', async () => {
    vi.mocked(hasShopperToken).mockResolvedValue(true);
    render(await NewAddressPage({ params: params({ locale: 'en' }), searchParams: query({ next: 'checkout' }) }));
    expect(screen.getByTestId('address-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Street')).toBeRequired();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/en/checkout');
  });

  it('edits an address of the book, and answers 404 for one that is not there', async () => {
    vi.mocked(loadAddressBook).mockResolvedValue({ status: 'ok', data: addressesFixture('en') });
    render(await EditAddressPage({ params: params({ locale: 'en', id: '501' }), searchParams: query() }));
    expect(screen.getByRole('heading', { level: 1, name: 'Edit address' })).toBeInTheDocument();
    expect(screen.getByLabelText('Street')).toHaveValue(addressesFixture('en').items[0].values.street);

    await expect(EditAddressPage({ params: params({ locale: 'en', id: '999' }), searchParams: query() })).rejects.toThrow('NOT_FOUND');
    await expect(EditAddressPage({ params: params({ locale: 'en', id: 'abc' }), searchParams: query() })).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(2);
  });
});

describe('order pages', () => {
  it('lists the orders', async () => {
    vi.mocked(loadOrders).mockResolvedValue({ status: 'ok', data: ordersFixture('en') });
    render(await OrdersPage({ params: params({ locale: 'en' }), searchParams: query() }));
    expect(loadOrders).toHaveBeenCalledWith('en', 1, 10);
    expect(screen.getAllByTestId('order-summary')).toHaveLength(10);
  });

  it('shows an order and loads the cancellation reasons only when the API allows cancelling', async () => {
    vi.mocked(loadOrder).mockResolvedValue({ status: 'ok', data: orderFixture('en') });
    vi.mocked(loadCancellationReasons).mockResolvedValue(cancellationReasonsFixture('en').items);
    render(await OrderPage({ params: params({ locale: 'en', id: 'mock-order-48201' }) }));
    expect(loadOrder).toHaveBeenCalledWith('en', 'mock-order-48201');
    expect(loadCancellationReasons).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();

    vi.mocked(loadCancellationReasons).mockClear();
    vi.mocked(loadOrder).mockResolvedValue({ status: 'ok', data: deliveredOrderFixture('en') });
    render(await OrderPage({ params: params({ locale: 'en', id: 'mock-order-48200' }) }));
    expect(loadCancellationReasons).not.toHaveBeenCalled();
  });

  it("answers 404 for an order that isn't the shopper's", async () => {
    vi.mocked(loadOrder).mockResolvedValue({ status: 'not-found' });
    await expect(OrderPage({ params: params({ locale: 'en', id: 'nope' }) })).rejects.toThrow('NOT_FOUND');
  });

  it('asks to sign in on an order page without a session', async () => {
    vi.mocked(loadOrder).mockResolvedValue({ status: 'signed-out' });
    render(await OrderPage({ params: params({ locale: 'en', id: 'mock-order-48201' }) }));
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/session/signin?returnUrl=%2Fen%2Faccount%2Forder-history%2Fmock-order-48201');
  });
});
