'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import type { FormField, Locale } from '@/sdk';
import { AuthFields } from '@/components/auth/AuthFields';
import { PasswordInput } from '@/components/auth/PasswordInput';
import type { FormState } from '@/lib/form';
import { checkFields, checkMessages, formTexts, unplacedErrors, type FieldCheck } from '@/lib/form-checks';
import { signUpAction } from './actions';

export interface SignUpLabels {
  submit: string;
  submitting: string;
  confirmPassword: string;
  optional: string;
  choose: string;
  notEditable: string;
  showPassword: string;
}

interface SignUpFormProps {
  /** `AuthSettings.signup.fields`: the form as the store configured it. */
  fields: FormField[];
  locale: Locale;
  labels: SignUpLabels;
  /** `AuthSettings.phone.length`: the store's phone number length (checked before sending). */
  phoneLength?: number | null;
}

const CONFIRMATION = 'passwordConfirmation';
const PASSWORD_MIN = 8;

/** What can be checked before sending: the store's `required`, e-mail / phone shape, password length and confirmation. */
export function signUpChecks(fields: readonly FormField[], phoneLength?: number | null): FieldCheck[] {
  const checks: FieldCheck[] = [];
  for (const field of fields) {
    checks.push({
      name: field.name,
      required: field.required,
      kind: field.kind,
      minLength: field.kind === 'password' ? PASSWORD_MIN : undefined,
      phoneLength: field.kind === 'phone' ? phoneLength : undefined,
    });
    if (field.kind === 'password') checks.push({ name: CONFIRMATION, required: field.required, kind: 'password', sameAs: field.name });
  }
  return checks;
}

/**
 * The sign-up card: the store's fields in its order, plus our password confirmation. Every simple
 * mistake is shown at once before anything is sent; then the API's messages (all of them). What was
 * typed stays in the fields after a refusal: the form is sent from `onSubmit`, not as a form action
 * (React resets a form after its action).
 */
export function SignUpForm({ fields, locale, labels, phoneLength }: SignUpFormProps) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const [checked, setChecked] = useState<Record<string, string> | null>(null);
  const errors = checked ?? state.fieldErrors ?? {};
  const unplaced = checked ? [] : unplacedErrors(state.fieldErrors ?? {}, [...fields.map((field) => field.name), CONFIRMATION]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const found = checkFields(formTexts(data), signUpChecks(fields, phoneLength), checkMessages(locale));
    if (Object.keys(found).length) {
      setChecked(found);
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setChecked(null);
    startTransition(() => dispatch(data));
  }

  return (
    <form onSubmit={submit} noValidate data-testid="sign-up-form" aria-busy={pending || undefined}>
      <input type="hidden" name="locale" value={locale} />
      {!checked && (state.message || unplaced.length > 0) && (
        <div className="alert" role="alert">
          {[state.message, ...unplaced].filter(Boolean).join(' ')}
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
              <PasswordInput
                name={CONFIRMATION}
                autoComplete="new-password"
                aria-invalid={Boolean(errors[CONFIRMATION])}
                aria-describedby={errors[CONFIRMATION] ? 'field-passwordConfirmation-error' : undefined}
                required
                toggleLabel={labels.showPassword}
              />
              {errors[CONFIRMATION] && (
                <span className="field-error" id="field-passwordConfirmation-error" role="alert">
                  {errors[CONFIRMATION]}
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
