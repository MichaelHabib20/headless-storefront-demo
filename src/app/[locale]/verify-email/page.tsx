import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AuthPage } from '@/components/auth/AuthPage';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { VerifyEmailForm } from './VerifyEmailForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authVerifyEmailTitle'), robots: { index: false } } : {};
}

const text = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** The changed-e-mail mail links here with `?email=&token=`; the confirmation happens on a click (a page view never writes). */
export default async function VerifyEmailPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const query = await searchParams;
  const email = text(query.email);
  const token = text(query.token);

  return (
    <AuthPage title={t('authVerifyEmailTitle')} lead={email && token ? t('authVerifyEmailLead') : null} testId="verify-email-page">
      {email && token ? (
        <VerifyEmailForm locale={locale} email={email} token={token} accountHref={routes.account(locale)} labels={{ confirm: t('authVerifyEmailConfirm'), confirming: t('authVerifying'), account: t('accountOverview') }} />
      ) : (
        <div data-testid="verify-email-invalid">
          <p className="muted">{t('authVerifyEmailInvalid')}</p>
          <p className="switch">
            <Link href={routes.account(locale)}>{t('accountOverview')}</Link>
          </p>
        </div>
      )}
    </AuthPage>
  );
}
