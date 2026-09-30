import { describe, expect, it } from 'vitest';
import { addressesFixture, checkoutSettingsFixture, locationsFixture } from '@/test/account-fixtures';
import type { Locations } from '@/sdk';
import { choose, errorFor, formLevels, idFromForm, inputAttributes, levelOptions, selectionOf, unmatchedErrors, valuesFromForm, type AddressForm } from './address-form';

const withDistricts: Locations = {
  cities: [
    {
      id: 1,
      name: 'Cairo',
      areas: [
        { id: 11, name: 'Nasr City', districts: [{ id: 111, name: 'District 7' }, { id: 112, name: 'District 8' }] },
        { id: 12, name: 'Maadi', districts: [{ id: 121, name: 'Degla' }] },
      ],
    },
  ],
};

describe('address form helpers', () => {
  it('keeps the levels the API lists, in its order, and skips unknown ones', () => {
    const form = { levels: ['city', 'area', 'district', 'street_block'], fields: [] } as unknown as AddressForm;
    expect(formLevels(form)).toEqual(['city', 'area', 'district']);
    expect(formLevels(checkoutSettingsFixture('en').addressForm)).toEqual(['city', 'area']);
  });

  it('offers each level the choices of the one above it', () => {
    const levels = formLevels(checkoutSettingsFixture('en').addressForm);
    const locations = locationsFixture('en');
    expect(levelOptions(locations, 'city', selectionOf(null), levels).map((o) => o.name)).toEqual(['Cairo', 'Giza']);
    expect(levelOptions(locations, 'area', selectionOf(null), levels)).toEqual([]);
    expect(levelOptions(locations, 'area', { cityId: 2, areaId: null, districtId: null }, levels).map((o) => o.name)).toEqual(['Dokki', 'Remote Oasis']);

    const all: ('city' | 'area' | 'district')[] = ['city', 'area', 'district'];
    expect(levelOptions(withDistricts, 'district', { cityId: 1, areaId: 12, districtId: null }, all)).toEqual([{ id: 121, name: 'Degla' }]);
    // no area picker in the store: the districts of the whole city
    expect(levelOptions(withDistricts, 'district', { cityId: 1, areaId: null, districtId: null }, ['city', 'district']).map((o) => o.id)).toEqual([111, 112, 121]);
  });

  it('clears the levels below a new choice', () => {
    const chosen = { cityId: 1, areaId: 11, districtId: 111 };
    expect(choose(chosen, 'city', 2)).toEqual({ cityId: 2, areaId: null, districtId: null });
    expect(choose(chosen, 'area', 12)).toEqual({ cityId: 1, areaId: 12, districtId: null });
    expect(choose(chosen, 'district', 112)).toEqual({ cityId: 1, areaId: 11, districtId: 112 });
  });

  it('starts from what an address already has', () => {
    expect(selectionOf(addressesFixture('en').items[0])).toEqual({ cityId: 1, areaId: 11, districtId: null });
  });

  it('turns a field kind into input attributes; unknown kinds are text', () => {
    expect(inputAttributes('phone')).toMatchObject({ type: 'tel', inputMode: 'tel' });
    expect(inputAttributes('email')).toMatchObject({ type: 'email' });
    expect(inputAttributes('text')).toEqual({ type: 'text' });
    expect(inputAttributes('whatsapp')).toEqual({ type: 'text' });
  });

  it("finds the API's message by the names the API used", () => {
    const errors = { street: 'Street is required.', 'values.building': 'Building is required.', areaId: 'Choose an area.', values: 'Something else.' };
    expect(errorFor(errors, 'street')).toBe('Street is required.');
    expect(errorFor(errors, 'building')).toBe('Building is required.');
    expect(errorFor(errors, 'areaId')).toBe('Choose an area.');
    expect(unmatchedErrors(errors, checkoutSettingsFixture('en').addressForm)).toEqual(['Something else.']);
  });

  it('reads the submitted values under the API field names (empty → null)', () => {
    const data = new FormData();
    data.set('locale', 'en');
    data.set('field.street', '  Tahrir St ');
    data.set('field.floor', ' ');
    data.set('cityId', '2');
    expect(valuesFromForm(data)).toEqual({ street: 'Tahrir St', floor: null });
    expect(idFromForm(data.get('cityId'))).toBe(2);
    for (const value of ['', '0', '-1', '1.5', 'x', null]) expect(idFromForm(value)).toBeNull();
  });
});
