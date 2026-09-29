'use client';

import { useActionState } from 'react';
import type { AuthConfig, Locale } from '@/sdk';
import type { FormState } from '@/lib/form';
import { signInAction } from './actions';

export function SignInForm({ loginMethod, locale }: { loginMethod: AuthConfig['loginMethod']; locale: Locale }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});
  const errors = state.fieldErrors ?? {};
  const isPhone = loginMethod === 'phone';

  return (
    <form action={action} noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.message && <div className="alert" role="alert">{state.message}</div>}

      <label>
        {isPhone ? 'Phone number' : 'Email'}
        <input
          name="identifier"
          type={isPhone ? 'tel' : 'email'}
          autoComplete={isPhone ? 'tel' : 'email'}
          inputMode={isPhone ? 'tel' : 'email'}
          defaultValue={state.values?.identifier}
          aria-invalid={Boolean(errors.identifier)}
          required
        />
        {errors.identifier && <span className="field-error">{errors.identifier}</span>}
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          required
        />
        {errors.password && <span className="field-error">{errors.password}</span>}
      </label>

      <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
