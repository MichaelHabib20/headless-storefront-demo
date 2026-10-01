'use client';

import { useActionState } from 'react';
import type { Locale } from '@/sdk';
import { changePasswordAction, type PasswordState } from './actions';

interface PasswordFormProps {
  locale: Locale;
  labels: { current: string; next: string; hint: string; confirm: string; submit: string; submitting: string };
}

export function PasswordForm({ locale, labels }: PasswordFormProps) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate data-testid="password-form">
      <input type="hidden" name="locale" value={locale} />
      {state.done && (
        <div className="success" role="status" data-testid="password-changed">
          {state.done}
        </div>
      )}
      {state.message && (
        <div className="alert" role="alert">
          {state.message}
        </div>
      )}
      <label>
        {labels.current}
        <input name="currentPassword" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} required />
        {errors.currentPassword && <span className="field-error">{errors.currentPassword}</span>}
      </label>
      <label>
        {labels.next} <span className="hint">{labels.hint}</span>
        <input name="newPassword" type="password" autoComplete="new-password" minLength={8} aria-invalid={Boolean(errors.newPassword)} required />
        {errors.newPassword && <span className="field-error">{errors.newPassword}</span>}
      </label>
      <label>
        {labels.confirm}
        <input name="passwordConfirmation" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.passwordConfirmation)} required />
        {errors.passwordConfirmation && <span className="field-error">{errors.passwordConfirmation}</span>}
      </label>
      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
