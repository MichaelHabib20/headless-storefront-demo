import { isApiError, type Locale } from '@/sdk';
import { translator } from './i18n';

export interface FormState {
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values (never passwords), so the form keeps what the user typed. */
  values?: Record<string, string>;
}

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** Errors whose message is the SDK's own (English only) or missing: replaced by ours, in the page's language. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/**
 * Turns any SDK error into something a form can show: the backend's localized message and its
 * per-field messages (keyed by the names it used; `fieldNames` renames them to the form's inputs).
 */
export function toFormState(error: unknown, values: Record<string, string>, fieldNames: Record<string, string> = {}, locale: Locale = 'en'): FormState {
  const t = translator(locale);
  if (!isApiError(error)) {
    console.error(error);
    return { message: t('authGenericError'), values };
  }
  const fieldErrors: Record<string, string> = {};
  for (const [name, messages] of Object.entries(error.fieldErrors)) {
    if (messages[0]) fieldErrors[fieldNames[name] ?? name] = messages[0];
  }
  if (error.kind === 'unauthenticated') return { message: t('authSessionGone'), fieldErrors, values };
  const message = LOCAL_ERRORS.has(error.kind) ? t('authGenericError') : error.message;
  return {
    message: error.kind === 'validation' && Object.keys(fieldErrors).length > 0 ? undefined : message,
    fieldErrors,
    values,
  };
}
