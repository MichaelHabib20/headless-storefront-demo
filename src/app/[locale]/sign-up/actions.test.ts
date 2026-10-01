import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getAuthSettings, signUp, type Session } from '@/sdk';
import { startSession } from '@/lib/session';
import { guestToken } from '@/lib/shopper.server';
import { authSettingsFixture } from '@/test/auth-fixtures';
import { signUpAction } from './actions';

const session: Session = {
  token: 'customer-token',
  customer: { id: 2, firstName: 'New', lastName: 'User', email: null, phone: '01000000000', phoneVerified: false, birthdate: null, image: null, approval: null, referralCode: null },
  next: null,
};

vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({ marker: 'client' })) }));
vi.mock('@/lib/session', () => ({ startSession: vi.fn() }));
vi.mock('@/lib/shopper.server', () => ({ guestToken: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), signUp: vi.fn(), getAuthSettings: vi.fn() }));

const fields = { locale: 'en', firstName: 'New', lastName: 'User', phone: '01000000000', email: '', birthdate: '1990-01-02', password: 'secret123', passwordConfirmation: 'secret123', isAdmin: '1' };

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(signUp).mockResolvedValue(session);
  vi.mocked(getAuthSettings).mockResolvedValue(authSettingsFixture('en'));
});

describe('signUpAction', () => {
  it("reads only the fields the store's form lists, sends them keyed by name with the guest token, then keeps the session", async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue('guest-3');

    await signUpAction({}, form(fields));

    const [, ctx, values] = vi.mocked(signUp).mock.calls[0];
    expect(ctx).toEqual({ locale: 'en', token: 'guest-3' });
    expect(values).toEqual({ firstName: 'New', lastName: 'User', phone: '01000000000', email: '', password: 'secret123', birthdate: '1990-01-02' });
    expect(values).not.toHaveProperty('isAdmin');
    expect(startSession).toHaveBeenCalledWith(session);
    expect(redirect).toHaveBeenLastCalledWith('/en/account');
  });

  it('follows Session.next (verify the phone) after the sign-up', async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue(null);
    vi.mocked(signUp).mockResolvedValue({ ...session, next: 'verify_phone' });
    await signUpAction({}, form({ ...fields, locale: 'ar' }));
    expect(redirect).toHaveBeenLastCalledWith('/ar/verify-phone');
  });

  it('still checks the password confirmation before calling the backend', async () => {
    const state = await signUpAction({}, form({ ...fields, passwordConfirmation: 'different' }));
    expect(state.fieldErrors).toEqual({ passwordConfirmation: 'The passwords do not match.' });
    expect(state.values).not.toHaveProperty('password');
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows the backend's field messages under the v3 names and keeps the guest", async () => {
    vi.mocked(guestToken).mockResolvedValue('guest-3');
    vi.mocked(signUp).mockRejectedValue(new ApiError('validation', 422, 'Check.', { phone: ['Enter a mobile number of 11 digits.'], lastName: ['Last name is required.'] }));

    const state = await signUpAction({}, form(fields));

    expect(state.fieldErrors).toEqual({ phone: 'Enter a mobile number of 11 digits.', lastName: 'Last name is required.' });
    expect(state.message).toBeUndefined();
    expect(startSession).not.toHaveBeenCalled();
  });

  it('shows the closed-sign-up text when the store turned sign-ups off', async () => {
    vi.mocked(getAuthSettings).mockResolvedValue({ ...authSettingsFixture('ar'), signup: { enabled: false, fields: [] } });
    expect((await signUpAction({}, form({ ...fields, locale: 'ar' }))).message).toBe('هذا المتجر لا يقبل حسابات جديدة حالياً.');
    expect(signUp).not.toHaveBeenCalled();
  });
});
