import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AuthPage } from '@/components/auth/AuthPage';
import { loadAuthSettings } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { ResetPasswordForm } from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authResetTitle'), robots: { index: false } } : {};
}

const text = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/**
 * New password. SMS stores: `?phone=` from the forgot step + the code. E-mail stores: the backend's
 * mail links here with `?token=&email=`.
 */
export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const query = await searchParams;
  const result = await loadAuthSettings(locale);
  const method = result.ok ? result.settings.passwordReset.method : null;
  const token = text(query.token);

  let body: React.ReactNode;
  if (!result.ok) {
    body = (
      <div className="alert" role="alert">
        {result.message}
      </div>
    );
  } else if (method === 'none' || (method === 'email' && !token)) {
    body = (
      <div data-testid="reset-link-invalid">
        <p className="muted">{method === 'none' ? t('authForgotNone') : t('authResetMissingToken')}</p>
        <p className="switch">
          <Link href={method === 'none' ? routes.contact(locale) : routes.forgotPassword(locale)}>{method === 'none' ? t('authForgotContact') : t('authResetAgain')}</Link>
        </p>
      </div>
    );
  } else {
    body = (
      <ResetPasswordForm
        method={method as 'sms' | 'email'}
        phone={text(query.phone)}
        token={token}
        phoneRules={result.settings.phone}
        locale={locale}
        labels={{ phone: t('authCompletePhone'), code: t('authResetCode'), password: t('authResetNewPassword'), passwordHint: t('passwordHint'), confirm: t('authConfirmPassword'), submit: t('authResetSubmit'), submitting: t('authResetSaving') }}
      />
    );
  }

  return (
    <AuthPage title={t('authResetTitle')} lead={method === 'sms' ? t('authResetLeadSms') : method === 'email' ? t('authResetLeadEmail') : null} testId="reset-password-page">
      {body}
    </AuthPage>
  );
}
