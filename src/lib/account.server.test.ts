import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getAddresses, getCheckoutSettings, getLocations, getOrder, getOrderCancellationReasons, getOrders } from '@/sdk';
import { addressesFixture, cancellationReasonsFixture, checkoutSettingsFixture, locationsFixture, orderFixture, ordersFixture } from '@/test/account-fixtures';
import { failureMessage, hasShopperToken, loadAddressBook, loadAddressForm, loadCancellationReasons, loadOrder, loadOrders } from './account.server';
import { ensureShopperContext, shopperContext } from './shopper.server';

vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  getAddresses: vi.fn(),
  getOrders: vi.fn(),
  getOrder: vi.fn(),
  getOrderCancellationReasons: vi.fn(),
  getCheckoutSettings: vi.fn(),
  getLocations: vi.fn(),
}));
vi.mock('./storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('./shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(shopperContext).mockImplementation(async (locale) => ({ locale, token: 'test-customer' }));
});

describe('account reads', () => {
  it('reads with the shopper token', async () => {
    vi.mocked(getAddresses).mockResolvedValue(addressesFixture('en'));
    vi.mocked(getOrders).mockResolvedValue(ordersFixture('ar'));
    vi.mocked(getOrder).mockResolvedValue(orderFixture('en'));

    await expect(loadAddressBook('en')).resolves.toEqual({ status: 'ok', data: addressesFixture('en') });
    await expect(loadOrders('ar', 2, 10)).resolves.toMatchObject({ status: 'ok' });
    expect(getOrders).toHaveBeenCalledWith(expect.anything(), { locale: 'ar', token: 'test-customer' }, { page: 2, perPage: 10 });
    await expect(loadOrder('en', 'mock-order-48201')).resolves.toMatchObject({ status: 'ok', data: { number: '48201' } });
  });

  it('never calls the API nor starts a guest session without a token', async () => {
    vi.mocked(shopperContext).mockResolvedValue({ locale: 'en', token: null });
    await expect(loadAddressBook('en')).resolves.toEqual({ status: 'signed-out' });
    await expect(loadOrders('en', 1, 10)).resolves.toEqual({ status: 'signed-out' });
    await expect(hasShopperToken('en')).resolves.toBe(false);
    expect(getAddresses).not.toHaveBeenCalled();
    expect(getOrders).not.toHaveBeenCalled();
    expect(ensureShopperContext).not.toHaveBeenCalled();
  });

  it('treats a 401 like no session, a 404 as not found, anything else as an error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getOrders).mockRejectedValue(new ApiError('unauthenticated', 401, 'Please start a session first.'));
    await expect(loadOrders('en', 1, 10)).resolves.toEqual({ status: 'signed-out' });
    vi.mocked(getOrder).mockRejectedValue(new ApiError('not_found', 404, 'Not found.'));
    await expect(loadOrder('en', 'nope')).resolves.toEqual({ status: 'not-found' });
    vi.mocked(getAddresses).mockRejectedValue(new ApiError('server', 500, 'Down.'));
    await expect(loadAddressBook('en')).resolves.toEqual({ status: 'error' });
    log.mockRestore();
  });

  it('loads the cancellation reasons, or null', async () => {
    vi.mocked(getOrderCancellationReasons).mockResolvedValueOnce(cancellationReasonsFixture('en'));
    await expect(loadCancellationReasons('en')).resolves.toEqual(cancellationReasonsFixture('en').items);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getOrderCancellationReasons).mockRejectedValueOnce(new ApiError('server', 500, 'Down.'));
    await expect(loadCancellationReasons('en')).resolves.toBeNull();
    log.mockRestore();
  });

  it("loads the store's address form and locations (public)", async () => {
    vi.mocked(getCheckoutSettings).mockResolvedValue(checkoutSettingsFixture('ar'));
    vi.mocked(getLocations).mockResolvedValue(locationsFixture('ar'));
    await expect(loadAddressForm('ar')).resolves.toEqual({ form: checkoutSettingsFixture('ar').addressForm, locations: locationsFixture('ar') });

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getLocations).mockRejectedValue(new ApiError('network', 0, 'Offline.'));
    await expect(loadAddressForm('ar')).resolves.toBeNull();
    log.mockRestore();
  });
});

describe('failureMessage', () => {
  it("passes on the backend's localized message, and uses ours for session and network problems", () => {
    expect(failureMessage(new ApiError('cannot_cancel', 409, 'لم يعد من الممكن إلغاء هذا الطلب.'), 'ar', 'orderActionError')).toBe('لم يعد من الممكن إلغاء هذا الطلب.');
    expect(failureMessage(new ApiError('unauthenticated', 401, 'x'), 'en', 'orderActionError')).toBe('Your session has expired. Sign in again to continue.');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(failureMessage(new ApiError('network', 0, 'Could not reach the store.'), 'ar', 'orderActionError')).toBe('تعذر تحديث طلبك. حاول مرة أخرى.');
    expect(failureMessage(new Error('boom'), 'en', 'addressesActionError')).toBe('We could not update your addresses. Please try again.');
    log.mockRestore();
  });
});
