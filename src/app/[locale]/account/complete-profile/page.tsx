import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError } from '@/components/account/AccountStates';
import { AuthPage } from '@/components/auth/AuthPage';
import { loadAuthSettings, loadProfile } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { CompleteProfileForm } from './CompleteProfileForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authCompleteTitle'), robots: { index: false } } : {};
}

/** After a social sign-in that gave no phone (`next = complete_profile`). */
export default async function CompleteProfilePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const [profile, settings] = await Promise.all([loadProfile(locale), loadAuthSettings(locale)]);
  if (profile.status === 'signed-out') redirect(routes.signIn(locale, routes.completeProfile(locale)));

  return (
    <AuthPage title={t('authCompleteTitle')} lead={t('authCompleteLead')} testId="complete-profile-page">
      {profile.status === 'ok' ? (
        <CompleteProfileForm
          customer={profile.data.customer}
          phone={settings.ok ? settings.settings.phone : { prefix: null, length: null, example: null }}
          locale={locale}
          labels={{ firstName: t('authCompleteFirstName'), lastName: t('authCompleteLastName'), phone: t('authCompletePhone'), email: t('authCompleteEmail'), optional: t('authOptional'), submit: t('authCompleteSubmit'), submitting: t('profileSaving') }}
        />
      ) : (
        <AccountLoadError locale={locale} retryHref={routes.completeProfile(locale)} />
      )}
    </AuthPage>
  );
}
