'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { Locale } from '@/sdk';
import { sendPhoneCodeAction, verifyPhoneAction, type VerifyState } from './actions';

interface VerifyPhoneFormProps {
  locale: Locale;
  next: string | null;
  laterHref: string;
  labels: { code: string; submit: string; submitting: string; resend: string; resending: string; later: string };
}

export function VerifyPhoneForm({ locale, next, laterHref, labels }: VerifyPhoneFormProps) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyPhoneAction, {});
  const [resendState, resendAction, resending] = useActionState<VerifyState, FormData>(sendPhoneCodeAction, {});
  const errors = state.fieldErrors ?? {};
  const notice = resendState.sent;

  return (
    <div>
      {notice && (
        <div className="success" role="status" data-testid="code-sent">
          {notice.message} {notice.destination}
        </div>
      )}
      {resendState.message && (
        <div className="alert" role="alert">
          {resendState.message}
        </div>
      )}
      <form action={action} noValidate data-testid="verify-phone-form">
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}
        {state.message && (
          <div className="alert" role="alert">
            {state.message}
          </div>
        )}
        <label>
          {labels.code}
          <input name="code" inputMode="numeric" autoComplete="one-time-code" aria-invalid={Boolean(errors.code)} required />
          {errors.code && <span className="field-error">{errors.code}</span>}
        </label>
        <button type="submit" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </button>
      </form>
      <form action={resendAction} className="links">
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="link-button" disabled={resending} data-testid="resend-code">
          {resending ? labels.resending : labels.resend}
        </button>
        <Link href={laterHref}>{labels.later}</Link>
      </form>
    </div>
  );
}
