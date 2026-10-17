'use client';

import Link from 'next/link';

import type { Locale } from '@/sdk';
import { verifyEmailAction, type VerifyEmailState } from './actions';
import { useSafeActionState } from '@/lib/safe-action';

interface VerifyEmailFormProps {
  locale: Locale;
  email: string;
  token: string;
  accountHref: string;
  labels: { confirm: string; confirming: string; account: string };
}

export function VerifyEmailForm({ locale, email, token, accountHref, labels }: VerifyEmailFormProps) {
  const [state, action, pending] = useSafeActionState<VerifyEmailState>(verifyEmailAction, {}, locale);

  if (state.done) {
    return (
      <div>
        <div className="success" role="status" data-testid="email-verified">
          {state.done}
        </div>
        <p className="switch">
          <Link href={accountHref}>{labels.account}</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} data-testid="verify-email-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <div className="alert" role="alert">
          {state.message}
        </div>
      )}
      <p className="muted">{email}</p>
      <button type="submit" disabled={pending}>
        {pending ? labels.confirming : labels.confirm}
      </button>
    </form>
  );
}
