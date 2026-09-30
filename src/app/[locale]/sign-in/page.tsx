import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { loadAuthConfig } from '@/lib/config';
import { routes } from '@/lib/routing';
import { readSession } from '@/lib/session';
import { SignInForm } from './SignInForm';
import '../auth.css';

export const dynamic = 'force-dynamic';

export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams?: Promise<{ next?: string | string[] }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Checkout sends shoppers here with ?next=checkout and gets them back after sign-in.
  const next = (await searchParams)?.next === 'checkout' ? 'checkout' : undefined;
  if (await readSession()) redirect(next ? routes.checkout(locale) : routes.account(locale));
  const result = await loadAuthConfig(locale);

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <p className="lead">Welcome back.</p>
      <div className="card">
        {result.ok ? (
          <SignInForm loginMethod={result.config.loginMethod} locale={locale} next={next} />
        ) : (
          <div className="alert" role="alert">{result.message}</div>
        )}
      </div>
      {result.ok && result.config.signupEnabled && (
        <p className="switch">
          New here? <Link href={routes.signUp(locale)}>Create an account</Link>
        </p>
      )}
    </div>
  );
}
