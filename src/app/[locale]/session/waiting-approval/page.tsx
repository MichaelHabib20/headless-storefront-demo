import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError } from '@/components/account/AccountStates';
import { AuthPage } from '@/components/auth/AuthPage';
import { signOutAction } from '@/lib/auth.actions';
import { loadProfile } from '@/lib/auth.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: translator(locale)('authWaitingTitle'), robots: { index: false } } : {};
}

/**
 * The store approves accounts by hand (`Customer.approval`): pending, or rejected with the
 * merchant's note. An approved (or not reviewed) account goes to its account page.
 */
export default async function WaitingApprovalPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const result = await loadProfile(locale);
  if (result.status === 'signed-out') redirect(routes.signIn(locale));
  const approval = result.status === 'ok' ? result.data.customer.approval : undefined;
  if (approval === null || approval?.status === 'approved') redirect(routes.account(locale));

  return (
    <AuthPage title={t('authWaitingTitle')} testId="waiting-approval-page">
      {approval ? (
        <div>
          <p className="muted" data-testid="approval-status" data-status={approval.status}>
            {approval.status === 'rejected' ? t('authWaitingRejected') : t('authWaitingPending')}
          </p>
          {approval.notes && (
            <p className="alert" role="status" data-testid="approval-notes">
              {approval.notes}
            </p>
          )}
          <form action={signOutAction.bind(null, locale)}>
            <button type="submit" data-testid="sign-out">
              {t('authWaitingSignOut')}
            </button>
          </form>
        </div>
      ) : (
        <AccountLoadError locale={locale} retryHref={routes.waitingApproval(locale)} />
      )}
    </AuthPage>
  );
}
