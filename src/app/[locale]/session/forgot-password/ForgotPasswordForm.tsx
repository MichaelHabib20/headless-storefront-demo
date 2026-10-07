'use client';

import { useActionState } from 'react';
import type { AuthSettings, Locale } from '@/sdk';
import { forgotPasswordAction, type ForgotState } from './actions';

interface ForgotPasswordFormProps {
  method: 'sms' | 'email';
  phone: AuthSettings['phone'];
  locale: Locale;
  labels: { identifierPhone: string; identifierEmail: string; submit: string; submitting: string };
}

export function ForgotPasswordForm({ method, phone, locale, labels }: ForgotPasswordFormProps) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});
  const errors = state.fieldErrors ?? {};
  const isPhone = method === 'sms';

  if (state.sent) {
    return (
      <div className="success" role="status" data-testid="reset-link-sent">
        {state.sent.message} {state.sent.destination}
      </div>
    );
  }

  return (
    <form action={action} noValidate data-testid="forgot-password-form">
      <input type="hidden" name="locale" value={locale} />
      {state.message && (
        <div className="alert" role="alert">
          {state.message}
        </div>
      )}
      <label>
        {isPhone ? labels.identifierPhone : labels.identifierEmail}
        <input
          name="identifier"
          type={isPhone ? 'tel' : 'email'}
          inputMode={isPhone ? 'numeric' : 'email'}
          autoComplete={isPhone ? 'tel' : 'email'}
          maxLength={isPhone ? phone.length ?? undefined : undefined}
          placeholder={isPhone ? phone.example ?? undefined : undefined}
          defaultValue={state.values?.identifier}
          aria-invalid={Boolean(errors.identifier)}
          required
        />
        {errors.identifier && <span className="field-error">{errors.identifier}</span>}
      </label>
      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
