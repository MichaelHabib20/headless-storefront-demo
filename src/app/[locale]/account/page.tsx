import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { clearSession, readSession } from '@/lib/session';
import '../auth.css';

export const dynamic = 'force-dynamic';

async function signOut(formData: FormData) {
  'use server';
  const locale = isLocale(formData.get('locale')) ? (formData.get('locale') as 'en' | 'ar') : 'en';
  // The current backend does not revoke tokens on logout, so we only forget it here.
  await clearSession();
  redirect(routes.signIn(locale));
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await readSession();
  if (!session) redirect(routes.signIn(locale));
  const { customer } = session;
  const t = translator(locale);

  return (
    <div className="auth-page">
      <h1>Hi, {customer.firstName}</h1>
      <p className="lead">You are signed in.</p>
      <nav className="card" aria-label={t('account')} data-testid="account-links">
        <ul>
          <li>
            <Link href={routes.orders(locale)}>{t('accountOrdersLink')}</Link>
          </li>
          <li>
            <Link href={routes.addresses(locale)}>{t('accountAddressesLink')}</Link>
          </li>
        </ul>
      </nav>
      <div className="card">
        <dl>
          <dt>Name</dt>
          <dd>{customer.firstName} {customer.lastName}</dd>
          <dt>Email</dt>
          <dd>{customer.email ?? '–'}</dd>
          <dt>Phone</dt>
          <dd>{customer.phone ?? '–'} {customer.phone && !customer.phoneVerified && '(not verified)'}</dd>
        </dl>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit">Sign out</button>
        </form>
      </div>
    </div>
  );
}
