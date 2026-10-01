import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import { changePassword, getProfile, updateProfile } from './account';
import {
  completeSocialProfile,
  forgotPassword,
  getAuthSettings,
  resetPassword,
  sendOtp,
  sendPhoneCode,
  signIn,
  signInWithOtp,
  signInWithProvider,
  signOut,
  signUp,
  verifyEmail,
  verifyPhone,
} from './auth';
import { createStorefrontClient, type StorefrontClient } from './http';

const ROOT = 'https://api.test/api/customer/v3/';

function setup(status = 200, body: unknown = { data: { value: 42 } }) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  const client = createStorefrontClient({ baseUrl: 'https://api.test', apiKey: 'k', fetch, revalidate: 60 });
  const lastCall = () => {
    const [url, init] = fetch.mock.calls.at(-1)!;
    return { url: String(url), init: init!, headers: init!.headers as Record<string, string> };
  };
  return { client, lastCall };
}

const guest = { locale: 'en' as const, token: 'guest-1' };
const nobody = { locale: 'ar' as const, token: null };
const customer = { locale: 'en' as const, token: 'cust-token' };

interface Case {
  name: string;
  call: (client: StorefrontClient) => Promise<unknown>;
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
  token: string | null;
  locale: 'en' | 'ar';
}

const CASES: Case[] = [
  { name: 'getAuthSettings', call: (c) => getAuthSettings(c, 'ar'), method: 'GET', path: 'auth/settings', token: null, locale: 'ar' },
  { name: 'signIn (guest merged)', call: (c) => signIn(c, guest, { identifier: '01222353123', password: 'secret123' }), method: 'POST', path: 'auth/sign-in', body: { identifier: '01222353123', password: 'secret123' }, token: 'guest-1', locale: 'en' },
  { name: 'signIn (no guest)', call: (c) => signIn(c, nobody, { identifier: 'a@b.test', password: 'x' }), method: 'POST', path: 'auth/sign-in', body: { identifier: 'a@b.test', password: 'x' }, token: null, locale: 'ar' },
  { name: 'signUp', call: (c) => signUp(c, guest, { firstName: 'S', phone: '01' }), method: 'POST', path: 'auth/sign-up', body: { values: { firstName: 'S', phone: '01' } }, token: 'guest-1', locale: 'en' },
  { name: 'signOut', call: (c) => signOut(c, customer), method: 'POST', path: 'auth/sign-out', token: 'cust-token', locale: 'en' },
  { name: 'signInWithProvider', call: (c) => signInWithProvider(c, nobody, { provider: 'google', token: 'g-token', name: null }), method: 'POST', path: 'auth/social', body: { provider: 'google', token: 'g-token', name: null }, token: null, locale: 'ar' },
  { name: 'completeSocialProfile', call: (c) => completeSocialProfile(c, customer, { firstName: 'S', lastName: 'G', phone: '01', email: null, birthdate: null }), method: 'POST', path: 'auth/social/complete', body: { firstName: 'S', lastName: 'G', phone: '01', email: null, birthdate: null }, token: 'cust-token', locale: 'en' },
  { name: 'sendOtp', call: (c) => sendOtp(c, 'en', '01222353123'), method: 'POST', path: 'auth/otp/send', body: { phone: '01222353123' }, token: null, locale: 'en' },
  { name: 'signInWithOtp', call: (c) => signInWithOtp(c, guest, { phone: '01', code: '1234' }), method: 'POST', path: 'auth/otp/verify', body: { phone: '01', code: '1234' }, token: 'guest-1', locale: 'en' },
  { name: 'forgotPassword', call: (c) => forgotPassword(c, 'ar', { identifier: '01', resetUrl: 'https://shop.test/ar/reset-password' }), method: 'POST', path: 'auth/password/forgot', body: { identifier: '01', resetUrl: 'https://shop.test/ar/reset-password' }, token: null, locale: 'ar' },
  { name: 'resetPassword', call: (c) => resetPassword(c, guest, { password: 'newsecret1', phone: '01', code: '1234' }), method: 'POST', path: 'auth/password/reset', body: { password: 'newsecret1', phone: '01', code: '1234' }, token: 'guest-1', locale: 'en' },
  { name: 'sendPhoneCode', call: (c) => sendPhoneCode(c, customer), method: 'POST', path: 'auth/phone/send-code', token: 'cust-token', locale: 'en' },
  { name: 'verifyPhone', call: (c) => verifyPhone(c, customer, '1234'), method: 'POST', path: 'auth/phone/verify', body: { code: '1234' }, token: 'cust-token', locale: 'en' },
  { name: 'verifyEmail', call: (c) => verifyEmail(c, 'en', { email: 'a@b.test', token: 't' }), method: 'POST', path: 'auth/email/verify', body: { email: 'a@b.test', token: 't' }, token: null, locale: 'en' },
  { name: 'getProfile', call: (c) => getProfile(c, customer), method: 'GET', path: 'account/profile', token: 'cust-token', locale: 'en' },
  { name: 'updateProfile', call: (c) => updateProfile(c, customer, { firstName: 'T', email: null }), method: 'PUT', path: 'account/profile', body: { values: { firstName: 'T', email: null } }, token: 'cust-token', locale: 'en' },
  { name: 'changePassword', call: (c) => changePassword(c, customer, { currentPassword: 'a', newPassword: 'bbbbbbbb' }), method: 'PUT', path: 'account/password', body: { currentPassword: 'a', newPassword: 'bbbbbbbb' }, token: 'cust-token', locale: 'en' },
];

describe('auth SDK', () => {
  it.each(CASES)('$name → $method $path', async ({ call, method, path, body, token, locale }) => {
    const { client, lastCall } = setup();
    await expect(call(client)).resolves.toEqual({ value: 42 });
    const { url, init, headers } = lastCall();
    expect(url).toBe(ROOT + path);
    expect(init.method).toBe(method);
    expect(headers['Accept-Language']).toBe(locale);
    if (token) expect(headers.Authorization).toBe(`Bearer ${token}`);
    else expect(headers.Authorization).toBeUndefined();
    if (body === undefined) expect(init.body).toBeUndefined();
    else expect(JSON.parse(String(init.body))).toEqual(body);
    // never cached: credentials and tokens travel here
    if (method !== 'GET' || token) expect(init.cache).toBe('no-store');
  });

  it('maps the auth error codes to kinds with the backend message', async () => {
    const cases: Array<[number, string]> = [
      [401, 'invalid_credentials'],
      [403, 'account_deactivated'],
      [403, 'social_account_only'],
      [403, 'signup_disabled'],
      [502, 'provider_error'],
      [422, 'code_expired'],
      [429, 'too_many_attempts'],
      [422, 'invalid_code'],
      [503, 'sms_unavailable'],
      [409, 'phone_already_verified'],
      [409, 'email_in_use'],
      [403, 'wrong_password'],
      [429, 'rate_limited'],
    ];
    for (const [status, code] of cases) {
      const { client } = setup(status, { error: { code, message: `msg ${code}` } });
      const error = (await signIn(client, nobody, { identifier: 'x', password: 'y' }).catch((e: unknown) => e)) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.kind).toBe(code);
      expect(error.message).toBe(`msg ${code}`);
    }
  });

  it('422 validation_failed keeps the v3 field names', async () => {
    const { client } = setup(422, { error: { code: 'validation_failed', message: 'Check.', fields: { lastName: ['Required.'], phone: ['11 digits.'] } } });
    const error = (await signUp(client, nobody, {}).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe('validation');
    expect(error.fieldErrors).toEqual({ lastName: ['Required.'], phone: ['11 digits.'] });
  });
});
