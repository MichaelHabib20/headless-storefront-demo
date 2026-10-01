import type { Locale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';

interface LoyaltyFallbackProps {
  locale: Locale;
  title: string;
  testId: string;
  /** This page's own URL: where sign-in comes back to, and the retry link. */
  href: string;
  status: 'signed-out' | 'error';
}

/** A loyalty page without its data: ask a guest to sign in (no guest session is created), or offer a retry. */
export function LoyaltyFallback({ locale, title, testId, href, status }: LoyaltyFallbackProps) {
  return (
    <AccountPage title={title} testId={testId}>
      {status === 'signed-out' ? <AccountSignIn locale={locale} returnTo={href} /> : <AccountLoadError locale={locale} retryHref={href} />}
    </AccountPage>
  );
}
