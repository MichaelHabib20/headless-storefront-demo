import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { addressesOf, addressRows, presentAddress } from './mock/account-state.mjs';
import { createModules } from './mock/modules.mjs';
import { createSettingsModule } from './mock/settings.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

describe('mock settings module follows the contract', () => {
  const settings = createSettingsModule();
  const request = (locale, pathname, method = 'GET') => ({ method, pathname, locale, query: new URLSearchParams(), token: null, body: null });

  it.each(['en', 'ar'])('settings and locations (%s)', (locale) => {
    expect(validate('CheckoutSettingsResponse', settings.handle(request(locale, '/checkout/settings'))[1])).toEqual([]);
    expect(validate('LocationsResponse', settings.handle(request(locale, '/locations'))[1])).toEqual([]);
  });

  it('leaves other paths and methods to the next module', () => {
    expect(settings.handle(request('en', '/cart'))).toBeNull();
    expect(settings.handle(request('en', '/locations', 'POST'))).toBeNull();
  });

  it('is part of the mock API', () => {
    const answers = createModules(createShopperStore()).map((part) => part.handle(request('en', '/locations')));
    expect(answers.some(Boolean)).toBe(true);
  });
});

describe('mock account state', () => {
  it.each(['en', 'ar'])('the seeded customer has one default address that fits the contract (%s)', (locale) => {
    const session = createShopperStore().session('test-customer');

    const addresses = addressesOf(session, locale);

    expect(addresses).toHaveLength(1);
    expect(addresses[0].isDefault).toBe(true);
    expect(validate('AddressesResponse', { data: { items: addresses } })).toEqual([]);
  });

  it('guests start without addresses, and an area the store does not serve is not deliverable', () => {
    expect(addressRows({ isGuest: true })).toEqual([]);
    const remote = presentAddress({ id: 9, isDefault: false, cityId: 2, areaId: 22, districtId: null, values: { street: 'Desert Rd', building: '1', phone: '01000000002' } }, 'en');
    expect(remote.deliverable).toBe(false);
    expect(validate('Address', remote)).toEqual([]);
  });
});
