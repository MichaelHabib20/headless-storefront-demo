'use client';

import { useActionState } from 'react';
import type { FormField, Locale } from '@/sdk';
import { AuthFields } from '@/components/auth/AuthFields';
import type { FormState } from '@/lib/form';
import { signUpAction } from './actions';

export interface SignUpLabels {
  submit: string;
  submitting: string;
  confirmPassword: string;
  optional: string;
  choose: string;
  notEditable: string;
}

interface SignUpFormProps {
  /** `AuthSettings.signup.fields`: the form as the store configured it. */
  fields: FormField[];
  locale: Locale;
  labels: SignUpLabels;
}

/** The sign-up card: the store's fields in its order, plus our password confirmation. */
export function SignUpForm({ fields, locale, labels }: SignUpFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate data-testid="sign-up-form">
      <input type="hidden" name="locale" value={locale} />
      {state.message && (
        <div className="alert" role="alert">
          {state.message}
        </div>
      )}
      <AuthFields
        fields={fields}
        values={state.values}
        errors={errors}
        labels={labels}
        after={(field) =>
          field.kind === 'password' ? (
            <label className="field">
              {labels.confirmPassword}
              <input name="passwordConfirmation" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.passwordConfirmation)} required />
              {errors.passwordConfirmation && (
                <span className="field-error" role="alert">
                  {errors.passwordConfirmation}
                </span>
              )}
            </label>
          ) : null
        }
      />
      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
