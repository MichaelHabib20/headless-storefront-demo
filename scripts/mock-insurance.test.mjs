import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createCheckoutModule } from './mock/checkout.mjs';
import { createInsuranceModule } from './mock/insurance.mjs';
import { createPrescriptionsModule } from './mock/prescriptions.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

function api(locale = 'en', on = true) {
  const store = createShopperStore();
  const insurance = createInsuranceModule(store);
  insurance.reset();
  insurance.mode({ insurance: { on } });
  const prescriptions = createPrescriptionsModule(store);
  const checkout = createCheckoutModule(store);
  const call = (method, pathname, body = null, token = 'test-customer', extra = {}) => {
    const request = { method, pathname, query: new URLSearchParams(), token, locale, body, contentType: '', headers: {}, raw: '', ...extra };
    const [status, payload] = insurance.handle(request) ?? prescriptions.handle(request) ?? checkout.handle(request) ?? store.handle(request);
    return { status, payload };
  };
  const upload = (name) => call('POST', '/uploads', null, 'test-customer', { contentType: 'multipart/form-data; boundary=x', raw: `--x\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n\r\ndata\r\n--x--` }).payload.data.id;
  return { call, upload, insurance };
}

describe('mock insurance follows the contract', () => {
  it('is off by default (as on staging): no page, no insurance kind', () => {
    const mock = api('en', false);
    expect(mock.call('GET', '/insurance').status).toBe(404);
    const form = mock.call('GET', '/prescriptions/form').payload.data;
    expect(form.fields.map((f) => f.name)).not.toContain('insuranceProfileId');
  });

  it.each(['en', 'ar'])('the page and its writes (%s)', (locale) => {
    const mock = api(locale);
    const page = mock.call('GET', '/insurance');
    expect([page.status, validate('InsurancePageResponse', page.payload)]).toEqual([200, []]);

    const refused = mock.call('POST', '/insurance/profiles', { companyId: 9 });
    expect([refused.status, Object.keys(refused.payload.error.fields).sort()]).toEqual([422, ['companyId', 'insuranceCardFiles', 'nationalId']]);

    const added = mock.call('POST', '/insurance/profiles', { companyId: 2, nationalId: '29001019999999', insuranceCardFiles: [mock.upload('a.jpg'), mock.upload('b.jpg')] });
    expect([added.status, validate('InsuranceProfileSavedResponse', added.payload)]).toEqual([201, []]);
    expect(added.payload.data.profile.nationalId).toBe('•••• 9999');

    const edited = mock.call('PUT', `/insurance/profiles/${added.payload.data.profile.id}`, { companyId: 1, name: 'Mona' });
    expect([edited.status, edited.payload.data.profile.nationalId]).toEqual([200, '•••• 9999']);

    const deleted = mock.call('DELETE', '/insurance/profiles/7');
    expect([deleted.status, validate('InsuranceProfileDeletedResponse', deleted.payload)]).toEqual([200, []]);
    expect(mock.call('DELETE', '/insurance/profiles/999').status).toBe(404);
  });

  it('the prescription form offers the insurance kind with its conditional fields, and sends it', () => {
    const mock = api();
    const form = mock.call('GET', '/prescriptions/form');
    expect(validate('PrescriptionFormResponse', form.payload)).toEqual([]);
    const fields = Object.fromEntries(form.payload.data.fields.map((f) => [f.name, f]));
    expect(fields.type.options.map((o) => o.value)).toContain('insurance');
    expect(fields.approvalNumber.showWhen).toEqual([{ field: 'type', values: ['insurance'] }, { field: 'preApproved', values: ['yes'] }]);

    const addressId = form.payload.data.addresses[0].id;
    const missing = mock.call('POST', '/prescriptions', { addressId, type: 'insurance', insuranceProfileId: '7', preApproved: 'yes', files: [] });
    expect(Object.keys(missing.payload.error.fields)).toEqual(['approvalNumber']);
    const sent = mock.call('POST', '/prescriptions', { addressId, type: 'insurance', insuranceProfileId: '7', preApproved: 'yes', approvalNumber: 'AP-1', files: [] });
    expect([sent.status, validate('PrescriptionSentResponse', sent.payload)]).toEqual([201, []]);
    expect(sent.payload.data.prescription.type).toBe('Insurance');
  });
});
