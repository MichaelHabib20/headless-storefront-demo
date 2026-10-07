import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createAddress, deleteAddress, setDefaultAddress, updateAddress } from '@/sdk';
import { ensureShopperContext } from '@/lib/shopper.server';
import { addressesFixture } from '@/test/account-fixtures';
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setDefaultAddress: vi.fn(),
}));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn(), guestToken: vi.fn(async () => null), forgetGuest: vi.fn() }));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const book = addressesFixture('en');
const saved = (id: number) => ({ address: { ...book.items[0], id }, items: book.items });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureShopperContext).mockImplementation(async (locale) => ({ locale, token: 'test-customer' }));
});

describe('saveAddressAction', () => {
  it('creates an address from the form, under the API field names, and goes to the list with the new id', async () => {
    vi.mocked(createAddress).mockResolvedValue(saved(601));

    await saveAddressAction({}, form({ locale: 'en', cityId: '2', areaId: '22', 'field.street': ' Desert Rd ', 'field.floor': '', isDefault: 'on' }));

    expect(createAddress).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'test-customer' }, {
      cityId: 2,
      areaId: 22,
      districtId: null,
      values: { street: 'Desert Rd', floor: null },
      isDefault: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
    expect(redirect).toHaveBeenCalledWith('/en/account/address?saved=601');
  });

  it('continues with the id the API answered after an edit (it can be a new one)', async () => {
    vi.mocked(updateAddress).mockResolvedValue(saved(777));

    await saveAddressAction({}, form({ locale: 'ar', addressId: '501', cityId: '1', areaId: '11', 'field.street': 'X' }));

    const [, , id, input] = vi.mocked(updateAddress).mock.calls[0];
    expect(id).toBe(501);
    expect(input).not.toHaveProperty('isDefault');
    expect(redirect).toHaveBeenCalledWith('/ar/account/address?saved=777');
  });

  it('goes back to checkout for ?next=checkout, and never to anything else', async () => {
    vi.mocked(createAddress).mockResolvedValue(saved(602));
    await saveAddressAction({}, form({ locale: 'en', cityId: '1', next: 'checkout' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/checkout');

    await saveAddressAction({}, form({ locale: 'en', cityId: '1', next: 'https://evil.test' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/account/address?saved=602');
  });

  it("passes the API's 422 messages on under the names the API used", async () => {
    vi.mocked(createAddress).mockRejectedValue(
      new ApiError('validation', 422, 'Please check the highlighted fields.', { areaId: ['Choose an area.'], phone: ['Enter a mobile number of 11 digits.', 'x'] }),
    );

    const state = await saveAddressAction({}, form({ locale: 'en', cityId: '2' }));

    expect(state).toEqual({ message: 'Please check the highlighted fields.', fieldErrors: { areaId: 'Choose an area.', phone: 'Enter a mobile number of 11 digits.' } });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('asks for a city (required by the contract) without calling the API', async () => {
    expect(await saveAddressAction({}, form({ locale: 'ar' }))).toEqual({ fieldErrors: { cityId: 'اختر المدينة.' } });
    expect(createAddress).not.toHaveBeenCalled();
  });

  it('uses our message when the store cannot be reached or the session is gone', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createAddress).mockRejectedValueOnce(new ApiError('network', 0, 'Could not reach the store.'));
    expect(await saveAddressAction({}, form({ locale: 'en', cityId: '1' }))).toEqual({ message: 'We could not save the address. Please try again.' });
    vi.mocked(createAddress).mockRejectedValueOnce(new ApiError('unauthenticated', 401, 'x'));
    expect(await saveAddressAction({}, form({ locale: 'en', cityId: '1' }))).toEqual({ message: 'Your session has expired. Sign in again to continue.' });
    log.mockRestore();
  });
});

describe('address book actions', () => {
  it('deletes and makes default, answering the address book the API returned', async () => {
    vi.mocked(deleteAddress).mockResolvedValue({ items: [book.items[1]] });
    vi.mocked(setDefaultAddress).mockResolvedValue(book);

    await expect(deleteAddressAction('en', 501)).resolves.toEqual({ ok: true, items: [book.items[1]] });
    expect(deleteAddress).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'test-customer' }, 501);
    await expect(setDefaultAddressAction('ar', 601)).resolves.toEqual({ ok: true, items: book.items });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("refuses impossible ids without calling the API, and passes the API's refusal on", async () => {
    expect(await deleteAddressAction('en', 1.5)).toEqual({ ok: false, message: 'We could not update your addresses. Please try again.' });
    expect(deleteAddress).not.toHaveBeenCalled();

    vi.mocked(setDefaultAddress).mockRejectedValue(new ApiError('not_found', 404, 'غير موجود.'));
    expect(await setDefaultAddressAction('ar', 9)).toEqual({ ok: false, message: 'غير موجود.' });
  });
});
