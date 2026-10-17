import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale, type Locale } from '@/sdk';
import { AuthPage } from '@/components/auth/AuthPage';
import { loadAuthSettings } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes, signInReturn } from '@/lib/routing';
import { readShopper } from '@/lib/session';
import { SignInForm, type SignInLabels } from './SignInForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authSignInTitle'), robots: { index: false } } : {};
}

function signInLabels(locale: Locale): SignInLabels {
  const t = translator(locale);
  return {
    identifierPhone: t('authCompletePhone'),
    identifierEmail: t('authCompleteEmail'),
    password: t('authPassword'),
    submit: t('authSignInButton'),
    submitting: t('authSigningIn'),
    forgot: t('authForgotPassword'),
    showPassword: t('authShowPassword'),
    tabPassword: t('authTabPassword'),
    tabOtp: t('authTabOtp'),
    otpSend: t('authOtpSend'),
    otpSending: t('authOtpSending'),
    otpCode: t('authOtpCode'),
    otpVerify: t('authOtpVerify'),
    otpChangePhone: t('authOtpChangePhone'),
    social: { or: t('authSocialOr'), google: t('authSocialGoogle'), facebook: t('authSocialFacebook'), apple: t('authSocialApple'), loading: t('authSocialLoading'), failed: t('authSocialFailed') },
  };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  // `?returnUrl=` (the old storefront's name; `?next=` too): checkout, or a page of this storefront to
  // come back to; anything else is ignored.
  const query = await searchParams;
  const next = signInReturn(locale, query.returnUrl ?? query.next);
  // Only a session the backend accepts skips the form: a dead token (signed out elsewhere, expired)
  // or a backend that can't be asked shows the form, so sign-in and the account never bounce.
  if ((await readShopper(locale)).session === 'live') redirect(next ?? routes.account(locale));
  const result = await loadAuthSettings(locale);

  return (
    <AuthPage
      title={t('authSignInTitle')}
      lead={t('authSignInLead')}
      footer={result.ok && result.settings.signup.enabled ? { text: t('authNewHere'), href: routes.signUp(locale), label: t('authCreateAccount') } : null}
      testId="sign-in-page"
    >
      {result.ok ? (
        <SignInForm settings={result.settings} locale={locale} next={next} forgotHref={routes.forgotPassword(locale)} labels={signInLabels(locale)} />
      ) : (
        <div className="alert" role="alert">
          {result.message}
        </div>
      )}
    </AuthPage>
  );
}
