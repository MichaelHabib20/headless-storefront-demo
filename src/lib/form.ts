import { isApiError } from '@/sdk';

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

/** Turns any SDK error into something a form can show. */
export function toFormState(error: unknown, values: Record<string, string>, fieldNames: Record<string, string> = {}): FormState {
  if (!isApiError(error)) {
    console.error(error);
    return { message: 'Something went wrong. Please try again.', values };
  }
  const fieldErrors: Record<string, string> = {};
  for (const [name, messages] of Object.entries(error.fieldErrors)) {
    if (messages[0]) fieldErrors[fieldNames[name] ?? name] = messages[0];
  }
  return {
    message: error.kind === 'validation' && Object.keys(fieldErrors).length > 0 ? undefined : error.message,
    fieldErrors,
    values,
  };
}
