import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createBankDetailsModule } from './mock/bank-details.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

describe('mock bank details follow the contract', () => {
  const setup = (on = true) => {
    const store = createShopperStore();
    const bank = createBankDetailsModule(store);
    bank.mode({ bankDetails: { on } });
    const call = (method, body = null, locale = 'en') => bank.handle({ method, pathname: '/account/bank-details', token: 'test-customer', locale, body });
    return { bank, call };
  };

  it('is off by default (as on staging)', () => {
    expect(setup(false).call('GET')[0]).toBe(404);
  });

  it.each(['en', 'ar'])('read, refuse, save (%s)', (locale) => {
    const { call } = setup();
    const [status, page] = call('GET', null, locale);
    expect([status, validate('BankDetailsResponse', page)]).toEqual([200, []]);
    expect(page.data.saved.map((row) => row.value)).toEqual(['CIB', '•••• 0002']);

    const [refused, why] = call('PUT', { fullName: 'Mona' }, locale);
    expect([refused, Object.keys(why.error.fields)]).toEqual([422, ['bankName', 'iban', 'swiftCode']]);

    const [saved, body] = call('PUT', { fullName: 'Mona Ali', bankName: 'NBE', iban: 'EG110003000000000000123456789', swiftCode: 'NBEGEGCX' }, locale);
    expect([saved, validate('BankDetailsSavedResponse', body)]).toEqual([200, []]);
    expect(body.data.details.saved.find((row) => row.value.startsWith('••••')).value).toBe('•••• 6789');
  });
});
