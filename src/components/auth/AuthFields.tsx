import type { ReactNode } from 'react';
import type { FormField } from '@/sdk';
import { PasswordInput } from './PasswordInput';

/** A FormField, optionally with the customer's current value and whether it may be changed (ProfileField). */
export type DrawnField = FormField & { value?: string | null; editable?: boolean };

interface AuthFieldsProps {
  /** The form as the API describes it, in order. */
  fields: DrawnField[];
  /** What the shopper typed last (kept after a refused submit); wins over `field.value`. */
  values?: Record<string, string | undefined>;
  /** The API's per-field messages, keyed by `field.name`. */
  errors?: Record<string, string | undefined>;
  /** `showPassword`: the name of the show / hide toggle on password fields (no toggle without it). */
  labels: { optional: string; choose: string; notEditable: string; showPassword?: string };
  /** Something to draw right after a field (e.g. the password confirmation after `password`). */
  after?: (field: DrawnField) => ReactNode;
}

const INPUT_TYPES: Record<string, string> = { email: 'email', phone: 'tel', password: 'password', date: 'date', text: 'text' };
const AUTOCOMPLETE: Record<string, string> = {
  firstName: 'given-name',
  lastName: 'family-name',
  email: 'email',
  phone: 'tel-national',
  password: 'new-password',
  birthdate: 'bday',
  country: 'country-name',
};

/**
 * Draws a backend-described form (`AuthSettings.signup.fields`, `Profile.fields`): one input per
 * field, with its label, `required`, `kind`, placeholder, hint, max length and options. The storefront
 * adds no field of its own and decides nothing about which fields exist. Values go back under
 * `field.name`; a field with `editable: false` is shown but not submitted.
 */
export function AuthFields({ fields, values = {}, errors = {}, labels, after }: AuthFieldsProps) {
  return (
    <>
      {fields.map((field) => {
        const id = `field-${field.name}`;
        const error = errors[field.name];
        const describedBy = [error ? `${id}-error` : null, field.hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
        const value = values[field.name] ?? field.value ?? '';
        const editable = field.editable !== false;
        const common = {
          id,
          name: field.name,
          required: field.required && editable,
          disabled: !editable,
          'aria-invalid': Boolean(error),
          'aria-describedby': describedBy,
        };

        return (
          <div key={field.name} className="field" data-field={field.name}>
            <label htmlFor={id}>
              {field.label}
              {!field.required && editable && <span className="hint"> {labels.optional}</span>}
              {!editable && <span className="hint"> ({labels.notEditable})</span>}
            </label>
            {field.kind === 'select' ? (
              <select {...common} defaultValue={value}>
                <option value="">{labels.choose}</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.kind === 'textarea' ? (
              <textarea {...common} defaultValue={value} maxLength={field.maxLength ?? undefined} placeholder={field.placeholder ?? undefined} />
            ) : field.kind === 'checkbox' ? (
              <input {...common} type="checkbox" value="1" defaultChecked={value === '1' || value === 'true'} />
            ) : field.kind === 'password' && labels.showPassword ? (
              <PasswordInput
                {...common}
                toggleLabel={labels.showPassword}
                autoComplete={AUTOCOMPLETE[field.name] ?? 'new-password'}
                maxLength={field.maxLength ?? undefined}
                placeholder={field.placeholder ?? undefined}
                minLength={8}
              />
            ) : (
              <input
                {...common}
                type={INPUT_TYPES[field.kind] ?? 'text'}
                inputMode={field.kind === 'phone' ? 'numeric' : undefined}
                autoComplete={AUTOCOMPLETE[field.name]}
                defaultValue={field.kind === 'password' ? undefined : value}
                maxLength={field.maxLength ?? undefined}
                placeholder={field.placeholder ?? undefined}
                minLength={field.kind === 'password' ? 8 : undefined}
              />
            )}
            {field.hint && (
              <span id={`${id}-hint`} className="hint">
                {field.hint}
              </span>
            )}
            {error && (
              <span id={`${id}-error`} className="field-error" role="alert">
                {error}
              </span>
            )}
            {after?.(field)}
          </div>
        );
      })}
    </>
  );
}
