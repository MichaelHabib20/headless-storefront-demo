'use client';

import { useActionState } from 'react';
import type { AuthConfig, Locale } from '@/sdk';
import type { FormState } from '@/lib/form';
import { signUpAction } from './actions';

type Props = Pick<AuthConfig, 'signupEmail' | 'showBirthdate' | 'showReferralCode' | 'phone'> & { locale: Locale };

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null;
}

export function SignUpForm({ signupEmail, showBirthdate, showReferralCode, phone, locale }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.message && <div className="alert" role="alert">{state.message}</div>}

      <div className="row">
        <label>
          First name
          <input name="firstName" autoComplete="given-name" defaultValue={values.firstName} aria-invalid={Boolean(errors.firstName)} required />
          <FieldError message={errors.firstName} />
        </label>
        <label>
          Last name
          <input name="lastName" autoComplete="family-name" defaultValue={values.lastName} aria-invalid={Boolean(errors.lastName)} required />
          <FieldError message={errors.lastName} />
        </label>
      </div>

      <label>
        Phone number
        {phone.length !== undefined && <span className="hint">{phone.length} digits</span>}
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={phone.length}
          defaultValue={values.phone}
          aria-invalid={Boolean(errors.phone)}
          required
        />
        <FieldError message={errors.phone} />
      </label>

      {signupEmail !== 'hidden' && (
        <label>
          Email {signupEmail === 'optional' && <span className="hint">(optional)</span>}
          <input
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values.email}
            aria-invalid={Boolean(errors.email)}
            required={signupEmail === 'required'}
          />
          <FieldError message={errors.email} />
        </label>
      )}

      {showBirthdate && (
        <label>
          Date of birth <span className="hint">(optional)</span>
          <input name="birthdate" type="date" defaultValue={values.birthdate} aria-invalid={Boolean(errors.birthdate)} />
          <FieldError message={errors.birthdate} />
        </label>
      )}

      <label>
        Password <span className="hint">At least 8 characters</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} aria-invalid={Boolean(errors.password)} required />
        <FieldError message={errors.password} />
      </label>

      <label>
        Confirm password
        <input
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.passwordConfirmation)}
          required
        />
        <FieldError message={errors.passwordConfirmation} />
      </label>

      {showReferralCode && (
        <label>
          Referral code <span className="hint">(optional)</span>
          <input name="referralCode" defaultValue={values.referralCode} aria-invalid={Boolean(errors.referralCode)} />
          <FieldError message={errors.referralCode} />
        </label>
      )}

      <button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
    </form>
  );
}
