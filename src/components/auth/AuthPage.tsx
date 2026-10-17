import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/app/[locale]/auth.css';

interface AuthPageProps {
  title: string;
  lead?: string | null;
  /** A line under the card: "New here? Create an account". */
  footer?: { text: string; href: string; label: string } | null;
  testId?: string;
  /** A wider column (the account's front page with its menu of cards). */
  wide?: boolean;
  children: ReactNode;
}

/** Frame of the auth pages (sign in / up, password reset, verification, waiting): a narrow column with one card. */
export function AuthPage({ title, lead, footer, testId, wide, children }: AuthPageProps) {
  return (
    <div className={wide ? 'auth-page auth-page-wide' : 'auth-page'} data-testid={testId}>
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      <div className="card">{children}</div>
      {footer && (
        <p className="switch">
          {footer.text} <Link href={footer.href}>{footer.label}</Link>
        </p>
      )}
    </div>
  );
}
