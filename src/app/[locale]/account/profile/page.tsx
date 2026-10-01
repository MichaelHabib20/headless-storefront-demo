import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { AuthPage } from '@/components/auth/AuthPage';
import { loadProfile } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { ProfileForm } from './ProfileForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('profileTitle'), robots: { index: false } } : {};
}

/** The customer's profile: the form the API describes (`Profile.fields`), with verification badges. */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const result = await loadProfile(locale);

  return (
    <AuthPage title={t('profileTitle')} lead={t('profileLead')} footer={result.status === 'ok' ? { text: '', href: routes.changePassword(locale), label: t('accountPasswordLink') } : null} testId="profile-page">
      {result.status === 'signed-out' && <AccountSignIn locale={locale} returnTo={routes.profile(locale)} />}
      {result.status === 'error' && <AccountLoadError locale={locale} retryHref={routes.profile(locale)} />}
      {result.status === 'ok' && (
        <>
          {result.data.customer.phone && (
            <p className="status-row muted" data-testid="phone-status">
              <span>{result.data.customer.phone}</span>
              {result.data.customer.phoneVerified ? (
                <span className="badge">{t('profileVerified')}</span>
              ) : (
                <>
                  <span className="badge badge-warn">{t('profileNotVerified')}</span>
                  <Link href={`${routes.verifyPhone(locale)}?next=${encodeURIComponent(routes.profile(locale))}`}>{t('authVerifyBannerLink')}</Link>
                </>
              )}
            </p>
          )}
          <ProfileForm fields={result.data.fields} locale={locale} labels={{ save: t('profileSave'), saving: t('profileSaving'), optional: t('authOptional'), choose: t('authChoose'), notEditable: t('profileNotEditable') }} />
        </>
      )}
    </AuthPage>
  );
}
