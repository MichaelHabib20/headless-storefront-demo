'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Locale } from '@/sdk';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { checkFields, checkMessages, formTexts, unplacedErrors, type FieldCheck } from '@/lib/form-checks';
import { changePasswordAction, type PasswordState } from './actions';

interface PasswordFormProps {
  locale: Locale;
  labels: { current: string; next: string; hint: string; confirm: string; submit: string; submitting: string; showPassword: string };
}

const NAMES = ['currentPassword', 'newPassword', 'passwordConfirmation'] as const;
const MIN_LENGTH = 8;

const CHECKS: FieldCheck[] = [
  { name: 'currentPassword', required: true, kind: 'password' },
  { name: 'newPassword', required: true, kind: 'password', minLength: MIN_LENGTH },
  { name: 'passwordConfirmation', required: true, kind: 'password', sameAs: 'newPassword' },
];

/**
 * Change password. Every simple mistake (empty field, too short, the two new passwords differ) is
 * shown at once before anything is sent; the API's messages come after. What was typed stays in the
 * fields after a refusal (like the old storefront): the form is sent from `onSubmit`, not as a form
 * action, which React would reset.
 */
export function PasswordForm({ locale, labels }: PasswordFormProps) {
  const [state, dispatch, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  const [checked, setChecked] = useState<Record<string, string> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = checked ?? state.fieldErrors ?? {};
  const unplaced = checked ? [] : unplacedErrors(state.fieldErrors ?? {}, NAMES);

  // Changed: the old passwords have no use any more.
  useEffect(() => {
    if (state.done) formRef.current?.reset();
  }, [state]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const found = checkFields(formTexts(data), CHECKS, checkMessages(locale));
    if (Object.keys(found).length) {
      setChecked(found);
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setChecked(null);
    startTransition(() => dispatch(data));
  }

  const error = (name: (typeof NAMES)[number]) =>
    errors[name] && (
      <span className="field-error" id={`password-${name}-error`} data-testid="field-error">
        {errors[name]}
      </span>
    );
  const describedBy = (name: (typeof NAMES)[number]) => (errors[name] ? `password-${name}-error` : undefined);

  return (
    <form ref={formRef} onSubmit={submit} noValidate data-testid="password-form" aria-busy={pending || undefined}>
      <input type="hidden" name="locale" value={locale} />
      {!checked && state.done && (
        <div className="success" role="status" data-testid="password-changed">
          {state.done}
        </div>
      )}
      {!checked && (state.message || unplaced.length > 0) && (
        <div className="alert" role="alert">
          {[state.message, ...unplaced].filter(Boolean).join(' ')}
        </div>
      )}
      <label>
        {labels.current}
        <PasswordInput name="currentPassword" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} aria-describedby={describedBy('currentPassword')} required toggleLabel={labels.showPassword} />
        {error('currentPassword')}
      </label>
      <label>
        {labels.next} <span className="hint">{labels.hint}</span>
        <PasswordInput name="newPassword" autoComplete="new-password" minLength={MIN_LENGTH} aria-invalid={Boolean(errors.newPassword)} aria-describedby={describedBy('newPassword')} required toggleLabel={labels.showPassword} />
        {error('newPassword')}
      </label>
      <label>
        {labels.confirm}
        <PasswordInput name="passwordConfirmation" autoComplete="new-password" aria-invalid={Boolean(errors.passwordConfirmation)} aria-describedby={describedBy('passwordConfirmation')} required toggleLabel={labels.showPassword} />
        {error('passwordConfirmation')}
      </label>
      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
