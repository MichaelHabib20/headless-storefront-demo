import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError } from '@/components/account/AccountStates';
import { AuthPage } from '@/components/auth/AuthPage';
import { loadProfile } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes, safeReturnPath } from '@/lib/routing';
import { VerifyPhoneForm } from './VerifyPhoneForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authVerifyPhoneTitle'), robots: { index: false } } : {};
}

/** The SMS code page after sign-up or a phone change. Shopping is allowed meanwhile ("do it later"). */
export default async function VerifyPhonePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const next = safeReturnPath((await searchParams).next);
  const result = await loadProfile(locale);
  if (result.status === 'signed-out') redirect(routes.signIn(locale, routes.verifyPhone(locale)));
  if (result.status === 'ok' && result.data.customer.phoneVerified) redirect(next ?? routes.account(locale));

  return (
    <AuthPage title={t('authVerifyPhoneTitle')} lead={result.status === 'ok' ? `${t('authVerifyPhoneLead')} ${result.data.customer.phone ?? ''}` : null} testId="verify-phone-page">
      {result.status === 'ok' ? (
        <VerifyPhoneForm
          locale={locale}
          next={next}
          laterHref={next ?? routes.home(locale)}
          labels={{ code: t('authVerifyCode'), submit: t('authVerifySubmit'), submitting: t('authVerifying'), resend: t('authVerifyResend'), resending: t('authOtpSending'), later: t('authVerifyLater') }}
        />
      ) : (
        <AccountLoadError locale={locale} retryHref={routes.verifyPhone(locale)} />
      )}
    </AuthPage>
  );
}
