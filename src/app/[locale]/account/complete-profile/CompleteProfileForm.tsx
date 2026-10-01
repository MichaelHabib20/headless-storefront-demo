'use client';

import { useActionState } from 'react';
import type { AuthSettings, Customer, Locale } from '@/sdk';
import type { FormState } from '@/lib/form';
import { completeProfileAction } from './actions';

interface CompleteProfileFormProps {
  customer: Customer;
  phone: AuthSettings['phone'];
  locale: Locale;
  labels: { firstName: string; lastName: string; phone: string; email: string; optional: string; submit: string; submitting: string };
}

/** `CompleteProfileRequest`: first name, last name, phone (required by the contract) and an optional e-mail. */
export function CompleteProfileForm({ customer, phone, locale, labels }: CompleteProfileFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeProfileAction, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} noValidate data-testid="complete-profile-form">
      <input type="hidden" name="locale" value={locale} />
      {state.message && (
        <div className="alert" role="alert">
          {state.message}
        </div>
      )}
      <div className="row">
        <label>
          {labels.firstName}
          <input name="firstName" autoComplete="given-name" defaultValue={values.firstName ?? customer.firstName} aria-invalid={Boolean(errors.firstName)} required />
          {errors.firstName && <span className="field-error">{errors.firstName}</span>}
        </label>
        <label>
          {labels.lastName}
          <input name="lastName" autoComplete="family-name" defaultValue={values.lastName ?? customer.lastName} aria-invalid={Boolean(errors.lastName)} required />
          {errors.lastName && <span className="field-error">{errors.lastName}</span>}
        </label>
      </div>
      <label>
        {labels.phone}
        <input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={phone.length ?? undefined} placeholder={phone.example ?? undefined} defaultValue={values.phone ?? customer.phone ?? ''} aria-invalid={Boolean(errors.phone)} required />
        {errors.phone && <span className="field-error">{errors.phone}</span>}
      </label>
      <label>
        {labels.email} <span className="hint">{labels.optional}</span>
        <input name="email" type="email" autoComplete="email" defaultValue={values.email ?? customer.email ?? ''} aria-invalid={Boolean(errors.email)} />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </label>
      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
