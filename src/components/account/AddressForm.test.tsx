/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Locale, Locations } from '@/sdk';
import { addressesFixture, checkoutSettingsFixture, locationsFixture } from '@/test/account-fixtures';
import type { AddressForm as AddressFormDescription } from './address-form';
import { AddressForm } from './AddressForm';
import type { SaveAddressAction } from './types';

function setup({
  locale = 'en',
  form = checkoutSettingsFixture(locale).addressForm,
  locations = locationsFixture(locale),
  address = null,
  action = vi.fn<SaveAddressAction>(async () => ({})),
}: {
  locale?: Locale;
  form?: AddressFormDescription;
  locations?: Locations;
  address?: ReturnType<typeof addressesFixture>['items'][number] | null;
  action?: ReturnType<typeof vi.fn<SaveAddressAction>>;
} = {}) {
  render(<AddressForm locale={locale} form={form} locations={locations} address={address} next={null} cancelHref="/x" action={action} />);
  return { action, form };
}

const submit = () => fireEvent.submit(screen.getByTestId('address-form'));

describe('AddressForm', () => {
  it.each(['en', 'ar'] as const)('draws the pickers and inputs the API describes, in its order (%s)', (locale) => {
    const { form } = setup({ locale });
    const labels = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]), select')].map((node) => node.getAttribute('name'));
    expect(labels).toEqual(['cityId', 'areaId', ...form.fields.map((field) => `field.${field.name}`)]);
    for (const field of form.fields) {
      const input = screen.getByLabelText(new RegExp(field.label)) as HTMLInputElement;
      expect(input.required).toBe(field.required);
      expect(input.type).toBe(field.kind === 'phone' ? 'tel' : 'text');
    }
    expect(screen.queryByTestId('address-district')).toBeNull();
  });

  it('shows only the levels the API lists, and feeds each from the one above', () => {
    const form: AddressFormDescription = { levels: ['city', 'area', 'district'], fields: [{ name: 'street', label: 'Street', required: true, kind: 'text' }] };
    const locations: Locations = {
      cities: [{ id: 1, name: 'Cairo', areas: [{ id: 11, name: 'Nasr City', districts: [{ id: 111, name: 'District 7' }] }, { id: 12, name: 'Maadi', districts: [] }] }],
    };
    setup({ form, locations });
    const area = screen.getByTestId('address-area') as HTMLSelectElement;
    const district = screen.getByTestId('address-district') as HTMLSelectElement;
    expect(area.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('address-city'), { target: { value: '1' } });
    expect([...area.options].map((o) => o.text)).toEqual(['Choose…', 'Nasr City', 'Maadi']);
    fireEvent.change(area, { target: { value: '11' } });
    expect([...district.options].map((o) => o.text)).toEqual(['Choose…', 'District 7']);
    fireEvent.change(district, { target: { value: '111' } });

    // a new city clears the levels below it
    fireEvent.change(area, { target: { value: '12' } });
    expect(district.value).toBe('');
    expect(district.disabled).toBe(true);

    setup({ form: { levels: ['city'], fields: [] } });
    expect(screen.getAllByTestId('address-city')).toHaveLength(2);
    expect(screen.getAllByTestId('address-area')).toHaveLength(1);
  });

  it('sends the values under the API field names', async () => {
    const { action } = setup();
    fireEvent.change(screen.getByTestId('address-city'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('address-area'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Tahrir St' } });
    fireEvent.click(screen.getByLabelText('Use as my default address'));
    submit();

    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0][1];
    expect(Object.fromEntries(data.entries())).toMatchObject({ locale: 'en', cityId: '2', areaId: '21', 'field.street': 'Tahrir St', isDefault: 'on' });
    expect(data.get('addressId')).toBeNull();
  });

  it('fills in the address being edited', () => {
    const address = addressesFixture('en').items[0];
    setup({ address });
    expect(screen.getByTestId('address-city')).toHaveValue('1');
    expect(screen.getByTestId('address-area')).toHaveValue('11');
    expect(screen.getByLabelText('Street')).toHaveValue(address.values.street);
    expect(document.querySelector('input[name=addressId]')).toHaveValue(String(address.id));
    // already the default: nothing to tick
    expect(screen.queryByLabelText('Use as my default address')).toBeNull();
  });

  it("shows the API's 422 messages next to the matching inputs, and keeps what was typed", async () => {
    const action = vi.fn<SaveAddressAction>(async () => ({
      message: 'Please check the highlighted fields.',
      fieldErrors: { areaId: 'Choose an area.', phone: 'Enter a mobile number of 11 digits.' },
    }));
    setup({ action });
    fireEvent.change(screen.getByTestId('address-city'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Desert Rd' } });
    submit();

    expect(await screen.findByText('Choose an area.')).toBeInTheDocument();
    expect(screen.getByTestId('address-area')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('address-area')).toHaveFocus();
    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription('Enter a mobile number of 11 digits.');
    expect(screen.getByLabelText('Street')).toHaveValue('Desert Rd');
    // every message found its input: no general message
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a general message when the API names no input of this form', async () => {
    const action = vi.fn<SaveAddressAction>(async () => ({ message: 'يرجى مراجعة الحقول المحددة.', fieldErrors: { location: 'المنطقة خارج نطاق التوصيل.' } }));
    setup({ locale: 'ar', action });
    submit();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('يرجى مراجعة الحقول المحددة.');
    expect(alert).toHaveTextContent('المنطقة خارج نطاق التوصيل.');
  });
});
