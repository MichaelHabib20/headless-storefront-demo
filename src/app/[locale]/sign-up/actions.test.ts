import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, signup, type Client, type Session } from '@/sdk';
import { saveSession } from '@/lib/session';
import { forgetGuest, guestToken } from '@/lib/shopper.server';
import { signUpAction } from './actions';

const session: Session = { token: 'customer-token', customer: { id: 2, firstName: 'New', lastName: 'User', email: null, phone: '01000000000', phoneVerified: false } };

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
vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), signup: vi.fn() }));

const fields = { locale: 'en', firstName: 'New', lastName: 'User', phone: '01000000000', password: 'secret123', passwordConfirmation: 'secret123' };

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const tokenOf = (client: unknown) => (client as Client & { token?: string }).token;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(signup).mockResolvedValue(session);
});

describe('signUpAction', () => {
  it("signs up with the guest's token so the backend merges the guest's lists, then forgets the guest", async () => {
    vi.mocked(guestToken).mockResolvedValue('guest-3');

    await signUpAction({}, form(fields));

    const [client, input] = vi.mocked(signup).mock.calls[0];
    expect(tokenOf(client)).toBe('guest-3');
    expect(input).toMatchObject({ firstName: 'New', lastName: 'User', phone: '01000000000', password: 'secret123' });
    expect(saveSession).toHaveBeenCalledWith(session);
    expect(forgetGuest).toHaveBeenCalledOnce();
  });

  it('signs up without a token when there is no guest session', async () => {
    vi.mocked(guestToken).mockResolvedValue(null);

    await signUpAction({}, form(fields));

    expect(tokenOf(vi.mocked(signup).mock.calls[0][0])).toBeUndefined();
    expect(forgetGuest).not.toHaveBeenCalled();
  });

  it('keeps the guest session when sign-up fails', async () => {
    vi.mocked(guestToken).mockResolvedValue('guest-3');
    vi.mocked(signup).mockRejectedValue(new ApiError('phone_taken', 422, 'Taken.', { phone: ['Taken.'] }));

    const state = await signUpAction({}, form(fields));

    expect(state.fieldErrors).toEqual({ phone: 'Taken.' });
    expect(forgetGuest).not.toHaveBeenCalled();
  });

  it('still checks the password confirmation before calling the backend', async () => {
    const state = await signUpAction({}, form({ ...fields, passwordConfirmation: 'different' }));
    expect(state.fieldErrors?.passwordConfirmation).toBeTruthy();
    expect(signup).not.toHaveBeenCalled();
  });
});
