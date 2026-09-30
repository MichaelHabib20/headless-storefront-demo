import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getAuthConfig, login, type Client, type Session } from '@/sdk';
import { saveSession } from '@/lib/session';
import { forgetGuest, guestToken } from '@/lib/shopper.server';
import { signInAction } from './actions';

const session: Session = { token: 'customer-token', customer: { id: 1, firstName: 'Test', lastName: 'User', email: 'a@b.test', phone: null, phoneVerified: true } };

const clients = vi.hoisted(() => {
  const make = (token?: string): { token?: string; locale: 'en'; request: () => never; withToken: (t: string | undefined) => unknown } => ({
    token,
    locale: 'en',
    request: () => {
      throw new Error('not used');
    },
    withToken: (next) => make(next),
  });
  return { make };
});

vi.mock('@/lib/store', () => ({ storeClient: vi.fn(() => clients.make()) }));
vi.mock('@/lib/session', () => ({ saveSession: vi.fn() }));
vi.mock('@/lib/shopper.server', () => ({ guestToken: vi.fn(), forgetGuest: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  getAuthConfig: vi.fn(async () => ({ loginMethod: 'email' })),
  login: vi.fn(),
}));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const tokenOf = (client: unknown) => (client as Client & { token?: string }).token;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(login).mockResolvedValue(session);
});

describe('signInAction', () => {
  it("signs in with the guest's token so the backend merges the guest's lists, then forgets the guest", async () => {
    vi.mocked(guestToken).mockResolvedValue('guest-7');

    await signInAction({}, form({ locale: 'en', identifier: 'a@b.test', password: 'secret123' }));

    expect(tokenOf(vi.mocked(getAuthConfig).mock.calls[0][0])).toBeUndefined();
    const [client, input] = vi.mocked(login).mock.calls[0];
    expect(tokenOf(client)).toBe('guest-7');
    expect(input).toEqual({ method: 'email', email: 'a@b.test', password: 'secret123' });
    expect(saveSession).toHaveBeenCalledWith(session);
    expect(forgetGuest).toHaveBeenCalledOnce();
    expect(vi.mocked(saveSession).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(forgetGuest).mock.invocationCallOrder[0]);
  });

  it('signs in without a token when there is no guest session', async () => {
    vi.mocked(guestToken).mockResolvedValue(null);

    await signInAction({}, form({ locale: 'en', identifier: 'a@b.test', password: 'secret123' }));

    expect(tokenOf(vi.mocked(login).mock.calls[0][0])).toBeUndefined();
    expect(saveSession).toHaveBeenCalledWith(session);
    expect(forgetGuest).not.toHaveBeenCalled();
  });

  it('goes back to the local page that asked for the sign-in, and nowhere else', async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(guestToken).mockResolvedValue(null);

    await signInAction({}, form({ locale: 'en', identifier: 'a@b.test', password: 'secret123', next: '/en/account/orders' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/account/orders');

    await signInAction({}, form({ locale: 'en', identifier: 'a@b.test', password: 'secret123', next: 'https://evil.test' }));
    expect(redirect).toHaveBeenLastCalledWith('/en/account');
  });

  it('keeps the guest session when sign-in fails', async () => {
    vi.mocked(guestToken).mockResolvedValue('guest-7');
    vi.mocked(login).mockRejectedValue(new ApiError('invalid_credentials', 403, 'The details you entered are not correct.'));

    const state = await signInAction({}, form({ locale: 'en', identifier: 'a@b.test', password: 'wrong' }));

    expect(state.message).toBe('The details you entered are not correct.');
    expect(saveSession).not.toHaveBeenCalled();
    expect(forgetGuest).not.toHaveBeenCalled();
  });
});
