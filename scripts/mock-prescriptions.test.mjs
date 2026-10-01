import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createModules } from './mock/modules.mjs';
import { createPrescriptionsModule } from './mock/prescriptions.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));
const request = (locale, pathname, method = 'GET', body = null, token = 'test-customer', query = '') => ({ method, pathname, locale, query: new URLSearchParams(query), token, body, headers: {} });

function setup() {
  const shopper = createShopperStore();
  const rx = createPrescriptionsModule(shopper);
  const session = shopper.session('test-customer');
  session.uploads = new Map([['mock-upload-1', 'rx.jpg'], ['mock-upload-2', 'rx.pdf']]);
  return { shopper, rx, session };
}

describe('mock prescriptions module follows the contract', () => {
  it.each(['en', 'ar'])('form, list, reasons (%s)', (locale) => {
    const { rx } = setup();
    const [status, form] = rx.handle(request(locale, '/prescriptions/form'));
    expect(status).toBe(200);
    expect(validate('PrescriptionFormResponse', form)).toEqual([]);
    expect(form.data.canSend).toBe(true);
    expect(validate('PrescriptionsResponse', rx.handle(request(locale, '/prescriptions'))[1])).toEqual([]);
    expect(validate('CancellationReasonsResponse', rx.handle(request(locale, '/prescriptions/cancellation-reasons'))[1])).toEqual([]);

    rx.mode({ prescriptions: { wasfaty: true, phone: 'unverified' } });
    const blocked = rx.handle(request(locale, '/prescriptions/form'))[1];
    expect(validate('PrescriptionFormResponse', blocked)).toEqual([]);
    expect([blocked.data.canSend, blocked.data.blockers.map((b) => b.code), blocked.data.fields[0].name]).toEqual([false, ['verify_phone'], 'type']);
  });

  it('sends: validation by v3 names, blockers, then 201', () => {
    const { rx } = setup();
    const [refused, errors] = rx.handle(request('en', '/prescriptions', 'POST', { addressId: 999, files: ['forged'] }));
    expect([refused, Object.keys(errors.error.fields)]).toEqual([422, ['files', 'addressId']]);
    expect(validate('ErrorResponse', errors)).toEqual([]);

    const addressId = rx.handle(request('en', '/prescriptions/form'))[1].data.addresses[0].id;
    rx.mode({ prescriptions: { phone: 'missing' } });
    const [blocked, body] = rx.handle(request('ar', '/prescriptions', 'POST', { addressId, files: ['mock-upload-1'] }));
    expect([blocked, body.error.code]).toEqual([409, 'prescription_blocked']);

    rx.mode({ prescriptions: { phone: 'ok' } });
    const [created, sent] = rx.handle(request('ar', '/prescriptions', 'POST', { addressId, files: ['mock-upload-1', 'mock-upload-2'], note: 'صباحاً' }));
    expect(created).toBe(201);
    expect(validate('PrescriptionSentResponse', sent)).toEqual([]);
    expect([sent.data.prescription.fileCount, sent.data.prescription.status.label]).toEqual([2, 'تم الاستلام']);
    expect(rx.handle(request('en', '/prescriptions'))[1].data.items.map((item) => item.id)).toEqual([sent.data.prescription.id, '1042', '1041']);
  });

  it('cancels a received one only', () => {
    const { rx } = setup();
    expect(rx.handle(request('en', '/prescriptions/1041/cancel', 'POST', { reasonId: 3 }))[0]).toBe(409);
    expect(rx.handle(request('en', '/prescriptions/1042/cancel', 'POST', { reasonId: 99 }))[0]).toBe(422);
    const [ok, body] = rx.handle(request('en', '/prescriptions/1042/cancel', 'POST', { reasonId: 4, note: 'Found it' }));
    expect(ok).toBe(200);
    expect(validate('PrescriptionResponse', body)).toEqual([]);
    expect([body.data.status.code, body.data.actions.canCancel, body.data.cancellation]).toEqual(['cancelled', false, { reason: 'Changed my mind', note: 'Found it' }]);
  });

  it('customers only, and 404 while switched off', () => {
    const { shopper, rx } = setup();
    const guest = shopper.handle({ method: 'POST', pathname: '/session/guest', locale: 'en', query: new URLSearchParams(), token: null, body: null, headers: {} })[1].data.token;
    expect(rx.handle(request('en', '/prescriptions', 'GET', null, guest))[0]).toBe(401);
    expect(rx.handle(request('en', '/prescriptions', 'GET', null, null))[0]).toBe(401);
    rx.mode({ prescriptions: { enabled: false } });
    expect(rx.handle(request('en', '/prescriptions/form'))[0]).toBe(404);
    expect(rx.decorate('layout', { features: { prescriptions: true } }).features.prescriptions).toBe(false);
  });

  it('is part of the mock API', () => {
    const answers = createModules(createShopperStore()).map((part) => part.handle(request('en', '/prescriptions/form')));
    expect(answers.filter(Boolean).map(([status]) => status)).toEqual([200]);
  });
});
