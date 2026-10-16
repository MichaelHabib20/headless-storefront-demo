import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AuthPage } from '@/components/auth/AuthPage';
import { ResetUnavailable } from '@/components/auth/ResetUnavailable';
import { loadAuthSettings, loadStoreWhatsapp } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authForgotTitle'), robots: { index: false } } : {};
}

/** Forgot password: the store decides the method (`passwordReset.method`: sms, email, or none → contact us). */
export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const result = await loadAuthSettings(locale);
  const method = result.ok ? result.settings.passwordReset.method : null;

  return (
    <AuthPage
      title={t('authForgotTitle')}
      lead={method === 'sms' ? t('authForgotLeadSms') : method === 'email' ? t('authForgotLeadEmail') : null}
      footer={{ text: t('authHaveAccount'), href: routes.signIn(locale), label: t('authSignInLink') }}
      testId="forgot-password-page"
    >
      {!result.ok ? (
        <div className="alert" role="alert">
          {result.message}
        </div>
      ) : method === 'none' ? (
        <ResetUnavailable locale={locale} whatsapp={await loadStoreWhatsapp(locale)} testId="reset-unavailable" />
      ) : (
        <ForgotPasswordForm
          method={method as 'sms' | 'email'}
          phone={result.settings.phone}
          locale={locale}
          labels={{ identifierPhone: t('authCompletePhone'), identifierEmail: t('authCompleteEmail'), submit: t('authForgotSend'), submitting: t('authForgotSending') }}
        />
      )}
    </AuthPage>
  );
}
