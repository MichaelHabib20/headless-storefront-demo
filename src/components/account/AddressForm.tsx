'use client';

import Link from 'next/link';
import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Address, Locale, Locations } from '@/sdk';
import { translator } from '@/lib/i18n';
import type { AddressReturn } from '@/lib/routing';
import { choose, errorFor, FIELD_PREFIX, formLevels, inputAttributes, LEVEL_INPUTS, levelOptions, selectionOf, unmatchedErrors } from './address-form';
import type { AddressForm as AddressFormDescription, Level } from './address-form';
import type { AddressFormState, SaveAddressAction } from './types';
import styles from './Account.module.css';
import { useSafeActionState } from '@/lib/safe-action';

interface AddressFormProps {
  locale: Locale;
  /** `CheckoutSettings.addressForm`: which location pickers and which text fields, in order. */
  form: AddressFormDescription;
  locations: Locations;
  /** The address being edited; absent for a new one. */
  address?: Address | null;
  next: AddressReturn | null;
  cancelHref: string;
  action: SaveAddressAction;
}

const LEVEL_LABELS = { city: 'addressCity', area: 'addressArea', district: 'addressDistrict' } as const;
const NOTHING_YET: AddressFormState = {};

/**
 * The address form, drawn only from the API's description: one picker per listed location level
 * (each fed by the one above it) and one input per field, with the API's label, `required` and
 * `kind`. Values go back under the API's field names; its 422 messages show next to the matching input.
 */
export function AddressForm({ locale, form, locations, address, next, cancelHref, action }: AddressFormProps) {
  const t = translator(locale);
  const [state, dispatch, pending] = useSafeActionState(action, NOTHING_YET, locale);
  const [selection, setSelection] = useState(() => selectionOf(address));
  const formRef = useRef<HTMLFormElement>(null);
  const levels = formLevels(form);
  const errors = state.fieldErrors ?? {};
  const unmatched = unmatchedErrors(errors, form);
  const general = state.message && (!Object.keys(errors).length || unmatched.length) ? state.message : null;

  // After a refused save, move to the first message so keyboard and screen reader users find it.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled), [data-form-message]')?.focus();
  }, [state]);

  // Submitted without resetting the form, so everything typed stays when the API refuses it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} aria-busy={pending || undefined} data-testid="address-form">
      <input type="hidden" name="locale" value={locale} />
      {address && <input type="hidden" name="addressId" value={address.id} />}
      {next && <input type="hidden" name="next" value={next} />}

      {general && (
        <div className={styles.error} role="alert" tabIndex={-1} data-form-message="">
          {general}
          {unmatched.length > 0 && (
            <ul className={styles.errorList}>
              {unmatched.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {levels.length > 0 && (
        <div className={styles.levels}>
          {levels.map((level) => (
            <LevelPicker
              key={level}
              level={level}
              label={t(LEVEL_LABELS[level])}
              placeholder={t('addressChoose')}
              options={levelOptions(locations, level, selection, levels)}
              value={selection[LEVEL_INPUTS[level]]}
              error={errorFor(errors, LEVEL_INPUTS[level])}
              onChange={(id) => setSelection((current) => choose(current, level, id))}
            />
          ))}
        </div>
      )}

      <div className={styles.fields}>
        {form.fields.map((field) => {
          const id = `address-field-${field.name}`;
          const error = errorFor(errors, field.name);
          return (
            <div key={field.name} className={styles.field}>
              <label htmlFor={id} className={styles.label}>
                {field.label}
                {!field.required && <span className={styles.optional}> {t('addressOptional')}</span>}
              </label>
              <input
                id={id}
                name={`${FIELD_PREFIX}${field.name}`}
                className={styles.input}
                {...inputAttributes(field.kind)}
                defaultValue={address?.values[field.name] ?? ''}
                required={field.required}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              {error && (
                <p id={`${id}-error`} className={styles.fieldError}>
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!address?.isDefault && (
        <label className={styles.checkbox}>
          <input type="checkbox" name="isDefault" />
          {t('addressMakeDefault')}
        </label>
      )}

      <div className={styles.formActions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? t('addressSaving') : t('addressSave')}
        </button>
        <Link href={cancelHref} className={styles.textButton}>
          {t('addressCancel')}
        </Link>
      </div>
    </form>
  );
}

interface LevelPickerProps {
  level: Level;
  label: string;
  placeholder: string;
  options: { id: number; name: string }[];
  value: number | null;
  error: string | undefined;
  onChange: (id: number | null) => void;
}

/** One location level. The city is required by the contract (`cityId`); the API says what else is missing. */
function LevelPicker({ level, label, placeholder, options, value, error, onChange }: LevelPickerProps) {
  const id = `address-${level}`;
  const current = value !== null && options.some((option) => option.id === value) ? String(value) : '';
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        name={LEVEL_INPUTS[level]}
        className={styles.select}
        value={current}
        required={level === 'city'}
        disabled={options.length === 0}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        data-testid={`address-${level}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
