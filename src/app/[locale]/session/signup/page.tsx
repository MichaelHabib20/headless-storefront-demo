import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AuthPage } from '@/components/auth/AuthPage';
import { loadAuthSettings } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { readSession } from '@/lib/session';
import { SignUpForm } from './SignUpForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authSignUpTitle'), robots: { index: false } } : {};
}

export default async function SignUpPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await readSession()) redirect(routes.account(locale));
  const t = translator(locale);
  const result = await loadAuthSettings(locale);

  let body: React.ReactNode;
  if (!result.ok) {
    body = (
      <div className="alert" role="alert">
        {result.message}
      </div>
    );
  } else if (!result.settings.signup.enabled) {
    body = (
      <div className="alert" role="alert" data-testid="sign-up-closed">
        {t('authSignUpClosed')}
      </div>
    );
  } else {
    body = (
      <SignUpForm
        fields={result.settings.signup.fields}
        locale={locale}
        phoneLength={result.settings.phone.length}
        labels={{ submit: t('authCreateButton'), submitting: t('authCreating'), confirmPassword: t('authConfirmPassword'), optional: t('authOptional'), choose: t('authChoose'), notEditable: t('profileNotEditable'), showPassword: t('authShowPassword') }}
      />
    );
  }

  return (
    <AuthPage title={t('authSignUpTitle')} lead={t('authSignUpLead')} footer={{ text: t('authHaveAccount'), href: routes.signIn(locale), label: t('authSignInLink') }} testId="sign-up-page">
      {body}
    </AuthPage>
  );
}
