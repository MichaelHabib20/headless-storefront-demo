import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountSignIn } from '@/components/account/AccountStates';
import { AuthPage } from '@/components/auth/AuthPage';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { customerToken } from '@/lib/session';
import { PasswordForm } from './PasswordForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('passwordTitle'), robots: { index: false } } : {};
}

export default async function ChangePasswordPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const signedIn = Boolean(await customerToken());

  return (
    <AuthPage title={t('passwordTitle')} lead={t('passwordLead')} footer={{ text: '', href: routes.profile(locale), label: t('accountProfileLink') }} testId="password-page">
      {signedIn ? (
        <PasswordForm locale={locale} labels={{ current: t('passwordCurrent'), next: t('passwordNew'), hint: t('passwordHint'), confirm: t('passwordConfirm'), submit: t('passwordSave'), submitting: t('passwordSaving') }} />
      ) : (
        <AccountSignIn locale={locale} returnTo={routes.changePassword(locale)} />
      )}
    </AuthPage>
  );
}
