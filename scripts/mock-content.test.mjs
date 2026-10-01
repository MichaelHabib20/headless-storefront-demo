import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createContentModule } from './mock/content.mjs';
import { createModules } from './mock/modules.mjs';
import { createShellModule } from './mock/shell.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));
const request = (locale, pathname, method = 'GET', body = null, token = null) => ({ method, pathname, locale, query: new URLSearchParams(), token, body, headers: {} });

describe('mock content module follows the contract', () => {
  const shopper = createShopperStore();
  const content = createContentModule(shopper);

  it.each(['en', 'ar'])('pages, branches, landing page and forms (%s)', (locale) => {
    for (const slug of ['about-us', 'privacy-policy', 'terms-and-conditions', 'cookie-policy', 'contact', 'branches']) {
      const [status, body] = content.handle(request(locale, `/pages/${slug}`));
      expect(status).toBe(200);
      expect(validate('PageResponse', body)).toEqual([]);
    }
    expect(validate('BranchesResponse', content.handle(request(locale, '/branches'))[1])).toEqual([]);
    expect(validate('LandingPageResponse', content.handle(request(locale, '/landing-pages/summer-sale'))[1])).toEqual([]);
    for (const slug of ['feedback', 'prescriptions']) expect(validate('FormResponse', content.handle(request(locale, `/forms/${slug}`))[1])).toEqual([]);
  });

  it('unknown pages, landing pages and forms are 404', () => {
    for (const path of ['/pages/nope', '/landing-pages/nope', '/forms/nope']) {
      const [status, body] = content.handle(request('en', path));
      expect(status).toBe(404);
      expect(validate('ErrorResponse', body)).toEqual([]);
    }
  });

  it('contact: 201 with the message, 422 with field messages in the request language', () => {
    const [ok, sent] = content.handle(request('en', '/contact', 'POST', { values: { name: 'Mona', phone: '0100', message: 'Hi' } }));
    expect([ok, validate('MessageResponse', sent)]).toEqual([201, []]);
    const [status, refused] = content.handle(request('ar', '/contact', 'POST', { values: { email: 'nope' } }));
    expect(status).toBe(422);
    expect(validate('ErrorResponse', refused)).toEqual([]);
    expect(refused.error.fields).toEqual({ name: ['هذا الحقل مطلوب.'], phone: ['هذا الحقل مطلوب.'], email: ['أدخل بريدًا إلكترونيًا صحيحًا.'], message: ['هذا الحقل مطلوب.'] });
  });

  it('form answers need a session, are validated, accept only the shopper own uploads', () => {
    expect(content.handle(request('en', '/forms/feedback/responses', 'POST', { values: {} }))[0]).toBe(401);
    const session = shopper.session('test-customer');
    session.uploads = new Map([['mock-upload-9', 'rx.png']]);
    const [refused, body] = content.handle(request('en', '/forms/feedback/responses', 'POST', { values: { firstName: 'M', phone: '1', field1: 'cairo', field3: 'Hi', field4: 'forged' } }, 'test-customer'));
    expect(refused).toBe(422);
    expect(body.error.fields).toEqual({ field1: ['Choose one of the options.'], field4: ['Please upload the file again.'] });
    const [ok, sent] = content.handle(request('en', '/forms/feedback/responses', 'POST', { values: { firstName: 'M', phone: '1', field1: 'obour', field2: ['prices'], field3: 'Hi', field4: 'mock-upload-9' } }, 'test-customer'));
    expect([ok, validate('MessageResponse', sent)]).toEqual([201, []]);
  });

  it('is part of the mock API', () => {
    const answers = createModules(createShopperStore()).map((part) => part.handle(request('en', '/branches')));
    expect(answers.some(Boolean)).toBe(true);
  });
});

describe('mock shell module follows the contract', () => {
  it.each(['en', 'ar'])('layout in every mode (%s)', (locale) => {
    const shell = createShellModule(createShopperStore());
    const base = shell.intercept(request(locale, '/layout'));
    expect(validate('Layout', base[1].data)).toEqual([]);
    expect(base[1].data.areaSelection).toBeNull();
    shell.mode({ multiInventory: true, banners: true, storeClosed: true });
    const all = shell.intercept(request(locale, '/layout'))[1].data;
    expect(validate('Layout', all)).toEqual([]);
    expect([all.areaSelection.required, all.topBanner !== null, all.floatingBanner !== null, all.storeStatus.acceptingOrders]).toEqual([true, true, true, false]);
  });

  it('maintenance answers 503 store_unavailable everywhere', () => {
    const shell = createShellModule(createShopperStore());
    shell.mode({ maintenance: true });
    for (const path of ['/layout', '/home', '/me', '/pages/about-us']) {
      const [status, body] = shell.intercept(request('ar', path));
      expect(status).toBe(503);
      expect(validate('ErrorResponse', body)).toEqual([]);
      expect(body.error).toEqual({ code: 'store_unavailable', message: 'نقوم بالتحديث — نعود قريباً' });
    }
    shell.reset();
    expect(shell.intercept(request('en', '/home'))).toBeNull();
  });

  it('PUT /me/area and Me.area', () => {
    const shopper = createShopperStore();
    const shell = createShellModule(shopper);
    shell.mode({ multiInventory: true });
    expect(shell.handle(request('en', '/me/area', 'PUT', { areaId: 12 }))[0]).toBe(401);
    const [refused, error] = shell.handle(request('en', '/me/area', 'PUT', { areaId: 22 }, 'test-customer'));
    expect([refused, error.error.fields.areaId[0]]).toEqual([422, 'This area is not available. Please choose another one.']);

    const [ok, me] = shell.handle(request('ar', '/me/area', 'PUT', { areaId: 12 }, 'test-customer'));
    expect(ok).toBe(200);
    expect(validate('MeResponse', me)).toEqual([]);
    expect(me.data.area).toEqual({ id: 12, name: 'المعادي', city: 'القاهرة' });
    const [, again] = shell.intercept(request('en', '/me', 'GET', null, 'test-customer'));
    expect(again.data.area).toEqual({ id: 12, name: 'Maadi', city: 'Cairo' });
    expect(shell.intercept(request('en', '/me'))[1].data.area).toBeNull();
  });

  it('the recorded layout fixtures carry the default shell keys', () => {
    for (const locale of ['en', 'ar']) {
      const layout = JSON.parse(fs.readFileSync(`src/test/fixtures/v3/layout.${locale}.json`, 'utf8')).data;
      const shell = createShellModule(createShopperStore()).intercept(request(locale, '/layout'))[1].data;
      for (const key of ['legal', 'appBanner', 'topBanner', 'floatingBanner', 'mobileNav', 'areaSelection', 'storeStatus']) expect(layout[key]).toEqual(shell[key]);
    }
  });
});
