import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, notifyWhenAvailable } from '@/sdk';
import { ensureShopperContext } from '@/lib/shopper.server';
import { notifyMeAction } from './actions';

vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), notifyWhenAvailable: vi.fn() }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn(), guestToken: vi.fn(async () => null), forgetGuest: vi.fn() }));

describe('notifyMeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensureShopperContext).mockImplementation(async (locale) => ({ locale, token: 'guest-1' }));
  });

  it('asks through the shopper session (a guest is started on this first write) and confirms', async () => {
    vi.mocked(notifyWhenAvailable).mockResolvedValue({ subscribed: true });
    await expect(notifyMeAction('en', 14400, null)).resolves.toEqual({ ok: true, message: "We'll let you know when it's back." });
    expect(ensureShopperContext).toHaveBeenCalledWith('en');
    expect(notifyWhenAvailable).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'guest-1' }, 14400, null);
  });

  it('sends the email only when one was typed', async () => {
    vi.mocked(notifyWhenAvailable).mockResolvedValue({ subscribed: true });
    await notifyMeAction('ar', 14400, '  sara@example.com ');
    expect(notifyWhenAvailable).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 14400, 'sara@example.com');
    await notifyMeAction('ar', 14400, '   ');
    expect(notifyWhenAvailable).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 14400, null);
  });

  it('passes on the email message when the backend needs one', async () => {
    vi.mocked(notifyWhenAvailable).mockRejectedValue(new ApiError('validation', 422, 'Check the fields.', { email: ['Enter your email.'] }));
    await expect(notifyMeAction('en', 14400, null)).resolves.toEqual({ ok: false, message: 'Check the fields.', emailError: 'Enter your email.' });
  });

  it('shows already_available as the backend worded it', async () => {
    vi.mocked(notifyWhenAvailable).mockRejectedValue(new ApiError('already_available', 409, 'It is back in stock.'));
    await expect(notifyMeAction('en', 8412, null)).resolves.toEqual({ ok: false, message: 'It is back in stock.' });
  });

  it('uses its own translated message when the store cannot be reached, and refuses bad input', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(notifyWhenAvailable).mockRejectedValue(new ApiError('network', 0, 'Could not reach the store.'));
    await expect(notifyMeAction('ar', 14400, null)).resolves.toEqual({ ok: false, message: 'تعذر حفظ طلبك. حاول مرة أخرى.' });
    log.mockRestore();

    vi.mocked(notifyWhenAvailable).mockClear();
    expect(await notifyMeAction('en', -1, null)).toMatchObject({ ok: false });
    expect(await notifyMeAction('en', 14400, 42 as unknown as string)).toMatchObject({ ok: false });
    expect(await notifyMeAction('en', 14400, `${'a'.repeat(260)}@x.io`)).toMatchObject({ ok: false });
    expect(notifyWhenAvailable).not.toHaveBeenCalled();
  });
});
