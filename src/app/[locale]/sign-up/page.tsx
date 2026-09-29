import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { loadAuthConfig } from '@/lib/config';
import { routes } from '@/lib/routing';
import { readSession } from '@/lib/session';
import { SignUpForm } from './SignUpForm';
import '../auth.css';

export const dynamic = 'force-dynamic';

const UNSUPPORTED_LABELS = {
  customer_group: 'choosing a customer group',
  international_country: 'choosing a country',
};

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await readSession()) redirect(routes.account(locale));
  const result = await loadAuthConfig(locale);

  let body: React.ReactNode;
  if (!result.ok) {
    body = <div className="alert" role="alert">{result.message}</div>;
  } else if (!result.config.signupEnabled) {
    body = <div className="alert" role="alert">Sign-up is currently closed for this store.</div>;
  } else if (result.config.unsupported.length > 0) {
    // Showing the form would only lead to a backend rejection, so say why instead.
    const needs = result.config.unsupported.map((item) => UNSUPPORTED_LABELS[item]).join(' and ');
    body = <div className="alert" role="alert">This store requires {needs} at sign-up, which this demo does not support yet.</div>;
  } else {
    const { signupEmail, showBirthdate, showReferralCode, phone } = result.config;
    body = <SignUpForm signupEmail={signupEmail} showBirthdate={showBirthdate} showReferralCode={showReferralCode} phone={phone} locale={locale} />;
  }

  return (
    <div className="auth-page">
      <h1>Create account</h1>
      <p className="lead">It takes less than a minute.</p>
      <div className="card">{body}</div>
      <p className="switch">
        Already have an account? <Link href={routes.signIn(locale)}>Sign in</Link>
      </p>
    </div>
  );
}
