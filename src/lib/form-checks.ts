import type { Locale } from '@/sdk';
import { translator } from './i18n';

/**
 * Client-side checks run before a form is sent, so the shopper sees every simple mistake at once
 * (like the old storefront) instead of one per round trip. They only cover what the form itself
 * knows — empty required fields, a too short password, two passwords that differ, an e-mail without
 * an @, a phone number of the wrong length (the store's `AuthSettings.phone.length`). The backend
 * still validates everything; its messages are shown as they come.
 */

export interface FieldCheck {
  name: string;
  required?: boolean;
  /** Minimum number of characters (passwords). */
  minLength?: number;
  /** `email`: must look like an e-mail address. `phone`: digits only, `phoneLength` long when set. */
  kind?: string;
  /** The store's phone length (`AuthSettings.phone.length`); unchecked when missing. */
  phoneLength?: number | null;
  /** Must be equal to this other field (password confirmation). */
  sameAs?: string;
}

export interface CheckMessages {
  required: string;
  /** With `{count}`. */
  tooShort: string;
  email: string;
  /** With `{count}`. */
  phone: string;
  mismatch: string;
}

/** The check messages in the page's language. */
export function checkMessages(locale: Locale): CheckMessages {
  const t = translator(locale);
  return { required: t('authCheckRequired'), tooShort: t('authCheckTooShort'), email: t('authCheckEmail'), phone: t('authCheckPhone'), mismatch: t('authPasswordsMismatch') };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Answers one message per field that fails, in the order of `checks` (empty = nothing to fix). */
export function checkFields(values: Record<string, string>, checks: readonly FieldCheck[], messages: CheckMessages): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const check of checks) {
    const value = values[check.name] ?? '';
    const trimmed = check.kind === 'password' ? value : value.trim();
    let error: string | null = null;
    if (!trimmed) {
      if (check.required) error = messages.required;
    } else if (check.minLength && trimmed.length < check.minLength) {
      error = messages.tooShort.replace('{count}', String(check.minLength));
    } else if (check.kind === 'email' && !EMAIL.test(trimmed)) {
      error = messages.email;
    } else if (check.kind === 'phone' && check.phoneLength && !new RegExp(`^[0-9٠-٩۰-۹]{${check.phoneLength}}$`).test(trimmed)) {
      error = messages.phone.replace('{count}', String(check.phoneLength));
    } else if (check.sameAs && trimmed !== (values[check.sameAs] ?? '')) {
      error = messages.mismatch;
    }
    if (error) errors[check.name] = error;
  }
  return errors;
}

/** The text values of a form, by input name (files and repeated names are left out). */
export function formTexts(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of data.entries()) if (typeof value === 'string' && !(name in values)) values[name] = value;
  return values;
}

/**
 * Field messages from the server that no input of the form shows (a name the form doesn't have):
 * shown together in the form's alert so no message returned by the API is lost.
 */
export function unplacedErrors(errors: Record<string, string>, shownNames: readonly string[]): string[] {
  return Object.entries(errors)
    .filter(([name]) => !shownNames.includes(name))
    .map(([, message]) => message);
}
