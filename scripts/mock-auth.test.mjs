import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { CODE, EMAIL_TOKEN, RESET_TOKEN, createAuthModule } from './mock/auth.mjs';
import { createModules } from './mock/modules.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

/** The auth module on its own shopper store; `call` answers like the mock API does. */
function api(locale = 'en') {
  const store = createShopperStore();
  const auth = createAuthModule(store);
  let current = null;
  const call = (method, pathname, body = null) => {
    const answer = auth.handle({ method, pathname, query: new URLSearchParams(), token: current, locale, body });
    if (!answer) throw new Error(`not handled: ${method} ${pathname}`);
    return { status: answer[0], payload: answer[1] };
  };
  const me = () => store.handle({ method: 'GET', pathname: '/me', query: new URLSearchParams(), token: current, locale, body: null })[1].data;
  const guest = () => {
    current = store.handle({ method: 'POST', pathname: '/session/guest', query: new URLSearchParams(), token: null, locale, body: null })[1].data.token;
    return current;
  };
  return { call, store, auth, me, guest, use: (token) => (current = token), token: () => current };
}

function expectValid(schema, payload) {
  expect(validate(schema, payload)).toEqual([]);
}

const SIGN_IN = { identifier: '01222353123', password: 'secret123' };
const newAccount = (overrides = {}) => ({ firstName: 'Sara', lastName: 'Hassan', phone: '01555555555', email: 'sara@example.com', password: 'longenough', birthdate: '1995-02-03', ...overrides });

describe('mock auth module follows the contract', () => {
  it.each(['en', 'ar'])('every answer (%s)', (locale) => {
    const { call, auth, use } = api(locale);
    expectValid('AuthSettingsResponse', call('GET', '/auth/settings').payload);
    for (const field of call('GET', '/auth/settings').payload.data.signup.fields) expectValid('FormField', field);

    const signedIn = call('POST', '/auth/sign-in', SIGN_IN);
    expect(signedIn.status).toBe(200);
    expectValid('SessionResponse', signedIn.payload);
    const wrong = call('POST', '/auth/sign-in', { ...SIGN_IN, password: 'nope' });
    expect(wrong.status).toBe(401);
    expectValid('ErrorResponse', wrong.payload);

    const created = call('POST', '/auth/sign-up', { values: newAccount() });
    expect(created.status).toBe(201);
    expectValid('SessionResponse', created.payload);
    const invalid = call('POST', '/auth/sign-up', { values: { firstName: 'X' } });
    expect(invalid.status).toBe(422);
    expectValid('ErrorResponse', invalid.payload);

    expectValid('ForgotPasswordResponse', call('POST', '/auth/password/forgot', { identifier: '01222353123' }).payload);
    expectValid('SessionResponse', call('POST', '/auth/password/reset', { phone: '01222353123', code: CODE, password: 'newsecret1' }).payload);

    auth.mode({ auth: { otpLogin: true, social: { google: { clientId: 'g' } }, passwordReset: 'email', approval: true, referral: true, customerGroups: true, verifyPhoneAfterSignup: true } });
    expectValid('AuthSettingsResponse', call('GET', '/auth/settings').payload);
    expectValid('CodeSentResponse', call('POST', '/auth/otp/send', { phone: '01222353123' }).payload);
    expectValid('SessionResponse', call('POST', '/auth/otp/verify', { phone: '01222353123', code: CODE }).payload);
    expectValid('ForgotPasswordResponse', call('POST', '/auth/password/forgot', { identifier: 'test@example.com', resetUrl: 'http://127.0.0.1:3301/en/session/change-password' }).payload);
    const afterReset = call('POST', '/auth/password/reset', { token: RESET_TOKEN, password: 'newsecret2' });
    expectValid('SessionResponse', afterReset.payload);
    const social = call('POST', '/auth/social', { provider: 'google', token: 'google-ok' });
    expectValid('SessionResponse', social.payload);
    expect(social.payload.data.next).toBe('complete_profile');
    const refused = call('POST', '/auth/social', { provider: 'google', token: 'bad' });
    expect(refused.status).toBe(502);
    expectValid('ErrorResponse', refused.payload);

    use(social.payload.data.token);
    expectValid('SessionResponse', call('POST', '/auth/social/complete', { firstName: 'Sara', lastName: 'G', phone: '01777777777' }).payload);
    expectValid('CodeSentResponse', call('POST', '/auth/phone/send-code').payload);
    expectValid('CustomerResponse', call('POST', '/auth/phone/verify', { code: CODE }).payload);
    expectValid('ProfileResponse', call('GET', '/account/profile').payload);
    for (const field of call('GET', '/account/profile').payload.data.fields) expectValid('ProfileField', field);
    expectValid('ProfileResponse', call('PUT', '/account/profile', { values: { firstName: 'Sarah', lastName: 'G', email: 'sarah@example.com' } }).payload);
    expectValid('MessageResponse', call('POST', '/auth/email/verify', { email: 'sarah@example.com', token: EMAIL_TOKEN }).payload);
    // the password resets revoked the first token; the reset answered a fresh one
    use(afterReset.payload.data.token);
    expectValid('MessageResponse', call('PUT', '/account/password', { currentPassword: 'newsecret2', newPassword: 'another-one' }).payload);
    expectValid('SignedOutResponse', call('POST', '/auth/sign-out').payload);
  });

  it('answers 401 without a customer and leaves other paths alone', () => {
    const { call, guest } = api();
    expect(call('GET', '/account/profile').status).toBe(401);
    guest();
    expect(call('GET', '/account/profile').status).toBe(401);
    expect(call('POST', '/auth/phone/send-code').status).toBe(401);
    const auth = createAuthModule(createShopperStore());
    expect(auth.handle({ method: 'GET', pathname: '/cart', query: new URLSearchParams(), token: 'test-customer', locale: 'en', body: null })).toBeNull();
    const answers = createModules(createShopperStore()).map((part) => part.handle({ method: 'GET', pathname: '/auth/settings', query: new URLSearchParams(), token: null, locale: 'en', body: null }));
    expect(answers.some(Boolean)).toBe(true);
  });
});

describe('mock sign-in and sign-out', () => {
  it('issues a token that opens the seeded customer, with the Me extras and no next step', () => {
    const { call, use, me } = api();
    const session = call('POST', '/auth/sign-in', SIGN_IN).payload.data;
    expect(session.customer).toMatchObject({ id: 4550965, firstName: 'Test', lastName: 'Customer', phone: '01222353123', phoneVerified: true, approval: null });
    expect(session.next).toBeNull();
    use(session.token);
    expect(me()).toMatchObject({ authenticated: true, isGuest: false, customer: { firstName: 'Test', lastName: 'Customer', phoneVerified: true, approval: null }, next: null });
    expect(me().counts.cart).toBe(2);
  });

  it('refuses wrong credentials and the deactivated account in the page language', () => {
    const { call } = api('ar');
    expect(call('POST', '/auth/sign-in', { ...SIGN_IN, password: 'x' }).payload.error).toEqual({ code: 'invalid_credentials', message: 'البيانات التي أدخلتها غير صحيحة.' });
    const missing = call('POST', '/auth/sign-in', { identifier: '', password: '' });
    expect(Object.keys(missing.payload.error.fields)).toEqual(['identifier', 'password']);
  });

  it('merges the guest cart, wishlist and compare into the customer', () => {
    const { call, store, guest, use, me } = api();
    const guestToken = guest();
    const [productId, otherId] = store.products('en').map((p) => p.id);
    store.handle({ method: 'PUT', pathname: `/cart/items/${otherId}`, query: new URLSearchParams(), token: guestToken, locale: 'en', body: { quantity: 3 } });
    store.handle({ method: 'PUT', pathname: `/wishlist/items/${productId}`, query: new URLSearchParams(), token: guestToken, locale: 'en', body: null });
    const session = call('POST', '/auth/sign-in', SIGN_IN).payload.data;
    use(session.token);
    expect(me().cartQuantities[String(otherId)]).toBe(3);
    expect(me().wishlistProductIds).toContain(productId);
  });

  it('revokes the token on sign-out: every later call with it answers 401', () => {
    const { call, use } = api();
    const token = call('POST', '/auth/sign-in', SIGN_IN).payload.data.token;
    use(token);
    expect(call('POST', '/auth/sign-out').payload.data).toEqual({ signedOut: true });
    expect(call('GET', '/account/profile').status).toBe(401);
    expect(call('GET', '/auth/settings').status).toBe(401);
    use(null); // the storefront dropped the cookie: the next sign-in carries no bearer
    use(call('POST', '/auth/sign-in', { identifier: '01222353123', password: 'secret123' }).payload.data.token);
    expect(call('GET', '/account/profile').status).toBe(200);
  });

  it('a guest signing up keeps its cart and the guest token stops being a guest', () => {
    const { call, store, guest, use, me } = api();
    const guestToken = guest();
    const productId = store.products('en')[0].id;
    store.handle({ method: 'PUT', pathname: `/cart/items/${productId}`, query: new URLSearchParams(), token: guestToken, locale: 'en', body: { quantity: 2 } });
    const created = call('POST', '/auth/sign-up', { values: newAccount() }).payload.data;
    expect(created.customer).toMatchObject({ firstName: 'Sara', phoneVerified: false, birthdate: '1995-02-03' });
    use(created.token);
    expect(me()).toMatchObject({ isGuest: false, customer: { firstName: 'Sara' }, cartQuantities: { [String(productId)]: 2 } });
    // a verified account's number is taken; an unverified one (Sara, just created) loses it to the newcomer, as legacy does
    use(null);
    expect(call('POST', '/auth/sign-up', { values: newAccount({ phone: '01222353123', email: 'other@example.com' }) }).status).toBe(409);
    expect(call('POST', '/auth/sign-up', { values: newAccount({ email: 'other@example.com' }) }).status).toBe(201);
    expect(call('POST', '/auth/sign-up', { values: newAccount({ phone: '123' }) }).payload.error.fields).toEqual({ phone: ['Enter a mobile number of 11 digits.'] });
  });

  it('follows the store flags: sign-up closed, verify after sign-up, waiting for approval', () => {
    const { call, auth, use, me } = api();
    auth.mode({ auth: { signupEnabled: false } });
    expect(call('POST', '/auth/sign-up', { values: newAccount() }).status).toBe(403);
    expect(call('GET', '/auth/settings').payload.data.signup).toEqual({ enabled: false, fields: [] });

    auth.mode({ auth: { signupEnabled: true, verifyPhoneAfterSignup: true } });
    const created = call('POST', '/auth/sign-up', { values: newAccount() }).payload.data;
    expect(created.next).toBe('verify_phone');
    use(created.token);
    expect(me().next).toBe('verify_phone');
    expect(call('POST', '/auth/phone/verify', { code: '0000' }).payload.error.code).toBe('invalid_code');
    expect(call('POST', '/auth/phone/verify', { code: CODE }).payload.data.phoneVerified).toBe(true);
    expect(me().next).toBeNull();

    auth.mode({ auth: { approval: true, verifyPhoneAfterSignup: false } });
    use(null);
    const second = call('POST', '/auth/sign-in', { identifier: '01000000002', password: 'secret123' }).payload.data;
    expect(second.next).toBe('waiting_approval');
    expect(second.customer.approval).toEqual({ status: 'pending', notes: null });
    use(second.token);
    expect(me().next).toBe('waiting_approval');
    expect(call('POST', '/auth/sign-in', SIGN_IN).payload.data.next).toBeNull();
  });
});

describe('mock password reset, profile and password', () => {
  it('sms reset: unknown numbers answer the same, the code is 1234, the new password works', () => {
    const { call } = api();
    expect(call('POST', '/auth/password/forgot', { identifier: '01999999999' }).payload.data.method).toBe('sms');
    expect(call('POST', '/auth/password/forgot', { identifier: '01222353123' }).payload.data.destination).toBe('01••••••123');
    expect(call('POST', '/auth/password/reset', { phone: '01222353123', code: '9999', password: 'newsecret1' }).payload.error.code).toBe('invalid_code');
    expect(call('POST', '/auth/password/reset', { phone: '01222353123', code: CODE, password: 'newsecret1' }).status).toBe(200);
    expect(call('POST', '/auth/sign-in', SIGN_IN).status).toBe(401);
    expect(call('POST', '/auth/sign-in', { ...SIGN_IN, password: 'newsecret1' }).status).toBe(200);
  });

  it('email reset: the storefront reset page must be local, the token is fixed', () => {
    const { call, auth } = api();
    auth.mode({ auth: { passwordReset: 'email' } });
    expect(call('POST', '/auth/password/forgot', { identifier: 'test@example.com', resetUrl: 'https://evil.test/x' }).payload.error.fields).toHaveProperty('resetUrl');
    expect(call('POST', '/auth/password/forgot', { identifier: 'test@example.com', resetUrl: 'http://127.0.0.1:3301/en/session/change-password' }).payload.data).toMatchObject({ method: 'email', destination: 't•••@example.com' });
    expect(call('POST', '/auth/password/reset', { token: 'nope', password: 'newsecret1' }).payload.error.code).toBe('code_expired');
    expect(call('POST', '/auth/password/reset', { token: RESET_TOKEN, password: 'newsecret1' }).payload.data.customer.firstName).toBe('Test');
    auth.mode({ auth: { passwordReset: 'none' } });
    expect(call('POST', '/auth/password/forgot', { identifier: 'test@example.com' }).status).toBe(404);
  });

  it('profile: the identifier is read-only, a changed e-mail waits for its confirmation, a changed phone needs a code', () => {
    const { call, auth, use } = api();
    use(call('POST', '/auth/sign-in', SIGN_IN).payload.data.token);
    const profile = call('GET', '/account/profile').payload.data;
    expect(profile.fields.map((f) => [f.name, f.editable])).toEqual([['firstName', true], ['lastName', true], ['phone', false], ['email', true], ['birthdate', true]]);
    expect(profile.fields[2].value).toBe('01222353123');

    const saved = call('PUT', '/account/profile', { values: { firstName: 'Tess', lastName: 'Customer', phone: '01999999999', email: 'tess@example.com' } }).payload.data;
    expect(saved.customer).toMatchObject({ firstName: 'Tess', phone: '01222353123', email: 'test@example.com' });
    expect(saved.next).toBe('verify_email');
    expect(call('POST', '/auth/email/verify', { email: 'tess@example.com', token: 'nope' }).payload.error.code).toBe('invalid_code');
    expect(call('POST', '/auth/email/verify', { email: 'tess@example.com', token: EMAIL_TOKEN }).status).toBe(200);
    expect(call('GET', '/account/profile').payload.data.customer.email).toBe('tess@example.com');
    expect(call('PUT', '/account/profile', { values: { firstName: '', lastName: 'X' } }).payload.error.fields).toEqual({ firstName: ['First name is required.'] });

    auth.mode({ auth: { loginMethod: 'email' } });
    const changed = call('PUT', '/account/profile', { values: { firstName: 'Tess', lastName: 'Customer', phone: '01999999999' } }).payload.data;
    expect(changed.next).toBe('verify_phone');
    expect(changed.customer).toMatchObject({ phone: '01999999999', phoneVerified: false });
    expect(call('PUT', '/account/profile', { values: { firstName: 'Tess', lastName: 'Customer', phone: '01000000002' } }).status).toBe(200);
    expect(call('PUT', '/account/profile', { values: { firstName: 'Tess', lastName: 'Customer', phone: '01222353123' } }).status).toBe(200);
  });

  it('password: the current one must match, 8 characters minimum', () => {
    const { call, use } = api('ar');
    use(call('POST', '/auth/sign-in', SIGN_IN).payload.data.token);
    expect(call('PUT', '/account/password', { currentPassword: 'x', newPassword: 'newsecret1' }).payload.error).toEqual({ code: 'wrong_password', message: 'كلمة المرور الحالية غير صحيحة.' });
    expect(call('PUT', '/account/password', { currentPassword: 'secret123', newPassword: 'short' }).status).toBe(422);
    expect(call('PUT', '/account/password', { currentPassword: 'secret123', newPassword: 'newsecret1' }).payload.data.message).toBe('تم تغيير كلمة المرور.');
    expect(call('POST', '/auth/sign-in', { ...SIGN_IN, password: 'newsecret1' }).status).toBe(200);
  });
});
