/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSettings, Locale } from '@/sdk';
import { loadAuthSettings, loadStoreWhatsapp } from '@/lib/auth.server';
import { authSettingsFixture } from '@/test/auth-fixtures';
import ResetPasswordPage from '../change-password/page';
import ForgotPasswordPage from './page';

vi.mock('@/lib/auth.server', () => ({ loadAuthSettings: vi.fn(), loadStoreWhatsapp: vi.fn() }));
vi.mock('./actions', () => ({ forgotPasswordAction: vi.fn() }));
vi.mock('../change-password/actions', () => ({ resetPasswordAction: vi.fn() }));

const WHATSAPP = { number: '201221919919', url: 'https://wa.me/201221919919' };

function settings(locale: Locale, method: AuthSettings['passwordReset']['method']) {
  const base = authSettingsFixture(locale);
  vi.mocked(loadAuthSettings).mockResolvedValue({ ok: true, settings: { ...base, passwordReset: { ...base.passwordReset, method } } });
}

const forgot = async (locale: Locale) => render(await ForgotPasswordPage({ params: Promise.resolve({ locale }) }));
const reset = async (locale: Locale, query: Record<string, string> = {}) =>
  render(await ResetPasswordPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  vi.mocked(loadStoreWhatsapp).mockReset().mockResolvedValue(WHATSAPP);
});

describe('password reset when the store resets no passwords online (passwordReset.method none, seif-staging)', () => {
  it.each([
    ['en', 'This store does not reset passwords online. Please contact us and we will help you.', 'Contact us', 'Chat on WhatsApp'],
    ['ar', 'هذا المتجر لا يعيد تعيين كلمات المرور عبر الإنترنت. تواصل معنا وسنساعدك.', 'اتصل بنا', 'تواصل عبر واتساب'],
  ] as const)('forgot and reset pages say so and link the contact page and WhatsApp (%s)', async (locale, text, contact, whatsapp) => {
    settings(locale, 'none');
    for (const [open, testId] of [[() => forgot(locale), 'reset-unavailable'], [() => reset(locale), 'reset-link-invalid']] as const) {
      const { unmount } = await open();
      const note = screen.getByTestId(testId);
      expect(note).toHaveTextContent(text);
      expect(screen.getByRole('link', { name: contact })).toHaveAttribute('href', `/${locale}/pages/contact`);
      expect(screen.getByRole('link', { name: whatsapp })).toHaveAttribute('href', WHATSAPP.url);
      expect(document.querySelector('form')).toBeNull();
      unmount();
    }
  });

  it('a store without WhatsApp: the contact link only', async () => {
    settings('en', 'none');
    vi.mocked(loadStoreWhatsapp).mockResolvedValue(null);
    await forgot('en');
    expect(screen.getByRole('link', { name: 'Contact us' })).toBeInTheDocument();
    expect(screen.queryByTestId('reset-whatsapp')).toBeNull();
  });
});

describe('password reset by e-mail (production seif)', () => {
  it.each(['en', 'ar'] as const)('the forgot page has the full e-mail form; the reset link page the new password form (%s)', async (locale) => {
    settings(locale, 'email');
    const first = await forgot(locale);
    expect(screen.queryByTestId('reset-unavailable')).toBeNull();
    const email = document.querySelector<HTMLInputElement>('input[name="identifier"]')!;
    expect(email.type).toBe('email');
    expect(screen.getByRole('button', { name: locale === 'en' ? 'Continue' : /متابعة|استمرار|إرسال/ })).toBeInTheDocument();
    expect(loadStoreWhatsapp).not.toHaveBeenCalled();
    first.unmount();

    await reset(locale, { token: 'reset-token-ok', email: 'test@example.com' });
    expect(document.querySelector('input[name="password"]')).not.toBeNull();
    expect(document.querySelector('input[name="passwordConfirmation"]')).not.toBeNull();
    expect(screen.queryByTestId('reset-link-invalid')).toBeNull();
  });
});
