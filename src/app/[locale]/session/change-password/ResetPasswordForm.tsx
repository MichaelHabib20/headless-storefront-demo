'use client';

import type { AuthSettings, Locale } from '@/sdk';
import { PasswordInput } from '@/components/auth/PasswordInput';
import type { FormState } from '@/lib/form';
import { resetPasswordAction } from './actions';
import { useSafeActionState } from '@/lib/safe-action';

interface ResetPasswordFormProps {
  method: 'sms' | 'email';
  /** SMS: the phone the code went to (from the forgot-password step); e-mail: the token from the link. */
  phone: string;
  token: string;
  phoneRules: AuthSettings['phone'];
  locale: Locale;
  labels: { phone: string; code: string; password: string; passwordHint: string; confirm: string; submit: string; submitting: string; showPassword: string };
}

export function ResetPasswordForm({ method, phone, token, phoneRules, locale, labels }: ResetPasswordFormProps) {
  const [state, action, pending] = useSafeActionState<FormState>(resetPasswordAction, {}, locale);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate data-testid="reset-password-form">
      <input type="hidden" name="locale" value={locale} />
      {method === 'email' && <input type="hidden" name="token" value={token} />}
      {state.message && (
        <div className="alert" role="alert">
          {state.message}
        </div>
      )}
      {method === 'sms' && (
        <>
          <label>
            {labels.phone}
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={phoneRules.length ?? undefined}
              defaultValue={state.values?.phone ?? phone}
              aria-invalid={Boolean(errors.phone)}
              required
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <label>
            {labels.code}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" defaultValue={state.values?.code} aria-invalid={Boolean(errors.code)} required />
            {errors.code && <span className="field-error">{errors.code}</span>}
          </label>
        </>
      )}
      <label>
        {labels.password} <span className="hint">{labels.passwordHint}</span>
        <PasswordInput name="password" autoComplete="new-password" minLength={8} aria-invalid={Boolean(errors.password)} required toggleLabel={labels.showPassword} />
        {errors.password && <span className="field-error">{errors.password}</span>}
      </label>
      <label>
        {labels.confirm}
        <PasswordInput name="passwordConfirmation" autoComplete="new-password" aria-invalid={Boolean(errors.passwordConfirmation)} required toggleLabel={labels.showPassword} />
        {errors.passwordConfirmation && <span className="field-error">{errors.passwordConfirmation}</span>}
      </label>
      {errors.token && (
        <div className="alert" role="alert">
          {errors.token}
        </div>
      )}
      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
