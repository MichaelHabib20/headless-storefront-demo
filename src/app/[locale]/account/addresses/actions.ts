'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createAddress,
  deleteAddress,
  isApiError,
  isLocale,
  setDefaultAddress,
  updateAddress,
  type AddressBook,
  type AddressInput,
  type AddressSaved,
  type Locale,
  type ShopperContext,
} from '@/sdk';
import { idFromForm, valuesFromForm } from '@/components/account/address-form';
import type { AddressBookResult, AddressFormState } from '@/components/account/types';
import { failureMessage } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { addressReturn, addressReturnHref, routes } from '@/lib/routing';
import { withShopper } from '@/lib/shopper.write';
import { storefrontClient } from '@/lib/storefront.server';

/*
 * Address book writes. The backend validates every address (required fields, location levels,
 * formats); the storefront only checks what the contract itself requires (a city) and passes the
 * API's messages on under the field names the API used.
 */

/** Saves the address form (new, or edit when `addressId` is sent), then goes back where the shopper came from. */
export async function saveAddressAction(_state: AddressFormState, formData: FormData): Promise<AddressFormState> {
  const locale = localeOf(formData.get('locale'));
  const cityId = idFromForm(formData.get('cityId'));
  if (!cityId) return { fieldErrors: { cityId: translator(locale)('addressCityRequired') } };

  const addressId = idFromForm(formData.get('addressId'));
  const next = addressReturn(text(formData.get('next')));
  const input: AddressInput = {
    cityId,
    areaId: idFromForm(formData.get('areaId')),
    districtId: idFromForm(formData.get('districtId')),
    values: valuesFromForm(formData),
    ...(formData.get('isDefault') === 'on' ? { isDefault: true } : {}),
  };

  let saved: AddressSaved;
  try {
    saved = await withShopper(locale, (ctx) =>
      addressId ? updateAddress(storefrontClient(), ctx, addressId, input) : createAddress(storefrontClient(), ctx, input),
    );
  } catch (error) {
    return formFailure(error, locale);
  }

  revalidatePath('/[locale]', 'layout');
  // Continue with the id in the answer: an edited address may have been given a new id.
  redirect(addressReturnHref(locale, next) ?? routes.addresses(locale, { saved: saved.address.id }));
}

export async function deleteAddressAction(locale: Locale, addressId: number): Promise<AddressBookResult> {
  return bookWrite(locale, addressId, (ctx) => deleteAddress(storefrontClient(), ctx, addressId));
}

export async function setDefaultAddressAction(locale: Locale, addressId: number): Promise<AddressBookResult> {
  return bookWrite(locale, addressId, (ctx) => setDefaultAddress(storefrontClient(), ctx, addressId));
}

/** Runs one change and answers with the address book the API now has. */
async function bookWrite(requested: unknown, addressId: unknown, call: (ctx: ShopperContext) => Promise<AddressBook>): Promise<AddressBookResult> {
  const locale = localeOf(requested);
  if (typeof addressId !== 'number' || !Number.isSafeInteger(addressId) || addressId < 1) {
    return { ok: false, message: translator(locale)('addressesActionError') };
  }
  try {
    const book = await withShopper(locale, call);
    revalidatePath('/[locale]', 'layout');
    return { ok: true, items: book.items };
  } catch (error) {
    return { ok: false, message: failureMessage(error, locale, 'addressesActionError') };
  }
}

function formFailure(error: unknown, locale: Locale): AddressFormState {
  if (isApiError(error) && error.kind === 'validation') {
    const fieldErrors: Record<string, string> = {};
    for (const [name, messages] of Object.entries(error.fieldErrors)) if (messages[0]) fieldErrors[name] = messages[0];
    return { message: error.message, fieldErrors };
  }
  return { message: failureMessage(error, locale, 'addressSaveError') };
}

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

function text(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' ? value : null;
}
