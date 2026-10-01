import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, sendOtp, signIn, signInWithOtp, signInWithProvider, type Session } from '@/sdk';
import { startSession } from '@/lib/session';
import { guestToken } from '@/lib/shopper.server';
import { sendOtpAction, signInAction, signInWithOtpAction, socialSignInAction } from './actions';

const session = (next: Session['next'] = null): Session => ({
  token: 'customer-token',
  customer: { id: 1, firstName: 'Test', lastName: 'User', email: 'a@b.test', phone: '01222353123', phoneVerified: true, birthdate: null, image: null, approval: null, referralCode: null },
  next,
});

vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({ marker: 'client' })) }));
vi.mock('@/lib/session', () => ({ startSession: vi.fn() }));
vi.mock('@/lib/shopper.server', () => ({ guestToken: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  signIn: vi.fn(),
  sendOtp: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithProvider: vi.fn(),
}));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(signIn).mockResolvedValue(session());
  vi.mocked(signInWithOtp).mockResolvedValue(session());
  vi.mocked(signInWithProvider).mockResolvedValue(session());
});

describe('signInAction', () => {
  it("sends the guest's token so the backend merges the guest's lists, keeps the session and forgets the guest", async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue('guest-7');

    await signInAction({}, form({ locale: 'en', identifier: '01222353123', password: 'secret123' }));

    const [, ctx, input] = vi.mocked(signIn).mock.calls[0];
    expect(ctx).toEqual({ locale: 'en', token: 'guest-7' });
    expect(input).toEqual({ identifier: '01222353123', password: 'secret123' });
    expect(startSession).toHaveBeenCalledWith(session());
    expect(redirect).toHaveBeenLastCalledWith('/en/account');
  });

  it('sends the identifier as typed: the backend decides e-mail vs phone', async () => {
    vi.mocked(guestToken).mockResolvedValue(null);
    await signInAction({}, form({ locale: 'ar', identifier: 'a@b.test', password: 'x' }));
    expect(vi.mocked(signIn).mock.calls[0][1]).toEqual({ locale: 'ar', token: null });
    expect(vi.mocked(signIn).mock.calls[0][2]).toEqual({ identifier: 'a@b.test', password: 'x' });
  });

  it('follows Session.next before the return page', async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue(null);

    vi.mocked(signIn).mockResolvedValue(session('verify_phone'));
    await signInAction({}, form({ locale: 'en', identifier: 'x', password: 'y', next: '/en/account/orders' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/verify-phone');

    vi.mocked(signIn).mockResolvedValue(session('waiting_approval'));
    await signInAction({}, form({ locale: 'ar', identifier: 'x', password: 'y' }));
    expect(redirect).toHaveBeenLastCalledWith('/ar/waiting-approval');

    vi.mocked(signIn).mockResolvedValue(session('complete_profile'));
    await signInAction({}, form({ locale: 'en', identifier: 'x', password: 'y' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/account/complete-profile');
  });

  it('goes back to checkout or a local page only, never to a URL from the form', async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue(null);

    await signInAction({}, form({ locale: 'ar', identifier: 'x', password: 'y', next: 'checkout' }));
    expect(redirect).toHaveBeenLastCalledWith('/ar/checkout');
    await signInAction({}, form({ locale: 'en', identifier: 'x', password: 'y', next: '/en/account/orders' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/account/orders');
    await signInAction({}, form({ locale: 'en', identifier: 'x', password: 'y', next: 'https://evil.test' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/account');
  });

  it("shows the backend's message and keeps the guest when the sign-in is refused", async () => {
    vi.mocked(guestToken).mockResolvedValue('guest-7');
    vi.mocked(signIn).mockRejectedValue(new ApiError('invalid_credentials', 401, 'البيانات التي أدخلتها غير صحيحة.'));

    const state = await signInAction({}, form({ locale: 'ar', identifier: 'x', password: 'wrong' }));

    expect(state.message).toBe('البيانات التي أدخلتها غير صحيحة.');
    expect(state.values).toEqual({ identifier: 'x' });
    expect(startSession).not.toHaveBeenCalled();
  });

  it('shows the per-field messages under the fields, and our own text when the store cannot be reached', async () => {
    vi.mocked(guestToken).mockResolvedValue(null);
    vi.mocked(signIn).mockRejectedValue(new ApiError('validation', 422, 'Check.', { identifier: ['Phone is required.'] }));
    expect((await signInAction({}, form({ locale: 'en', identifier: '', password: 'y' }))).fieldErrors).toEqual({ identifier: 'Phone is required.' });

    vi.mocked(signIn).mockRejectedValue(new ApiError('network', 0, 'Could not reach the store.'));
    expect((await signInAction({}, form({ locale: 'ar', identifier: 'x', password: 'y' }))).message).toBe('حدث خطأ ما. حاول مرة أخرى.');
  });
});

describe('OTP and social sign-in', () => {
  it('sends the code, then signs in with it (guest merged) and follows next', async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue('guest-2');
    vi.mocked(sendOtp).mockResolvedValue({ message: 'Sent.', destination: '01••••••123', expiresInSeconds: 1800, codeLength: 4 });

    const sent = await sendOtpAction({}, form({ locale: 'en', phone: '01222353123' }));
    expect(sent.sent).toEqual({ phone: '01222353123', message: 'Sent.', destination: '01••••••123' });

    await signInWithOtpAction({}, form({ locale: 'en', phone: '01222353123', code: '1234', next: '/en/cart' }));
    expect(vi.mocked(signInWithOtp).mock.calls[0][1]).toEqual({ locale: 'en', token: 'guest-2' });
    expect(vi.mocked(signInWithOtp).mock.calls[0][2]).toEqual({ phone: '01222353123', code: '1234' });
    expect(startSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenLastCalledWith('/en/cart');
  });

  it('keeps the code step open with the backend message when the code is wrong', async () => {
    vi.mocked(guestToken).mockResolvedValue(null);
    vi.mocked(signInWithOtp).mockRejectedValue(new ApiError('invalid_code', 422, 'The code is not correct.'));
    const state = await signInWithOtpAction({}, form({ locale: 'en', phone: '01222353123', code: '0000' }));
    expect(state.message).toBe('The code is not correct.');
    expect(state.sent?.phone).toBe('01222353123');
  });

  it("hands the provider's token to the backend and refuses unknown providers", async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue(null);
    vi.mocked(signInWithProvider).mockResolvedValue(session('complete_profile'));

    await socialSignInAction('en', 'google', 'id-token', null, null);
    expect(vi.mocked(signInWithProvider).mock.calls[0][2]).toEqual({ provider: 'google', token: 'id-token', name: null });
    expect(redirect).toHaveBeenLastCalledWith('/en/account/complete-profile');

    expect(await socialSignInAction('en', 'twitter' as never, 'x', null, null)).toEqual({ ok: false, message: 'We could not sign you in with this provider. Please try again.' });
    vi.mocked(signInWithProvider).mockRejectedValue(new ApiError('provider_error', 502, 'Provider refused.'));
    expect(await socialSignInAction('en', 'facebook', 'x', null, null)).toEqual({ ok: false, message: 'Provider refused.' });
  });
});
