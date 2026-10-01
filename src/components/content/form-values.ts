import type { FormField } from '@/sdk';

/** Inputs of a backend-described form are named `v.<field name>`: nothing else on the page can collide. */
export const VALUE_PREFIX = 'v.';

export const inputName = (field: Pick<FormField, 'name'>) => `${VALUE_PREFIX}${field.name}`;

/**
 * The values to send for a backend-described form: one entry per field of the description, under
 * the field's name. A multi-select sends a list; empty inputs are left out (the backend says what
 * is required). Inputs that are not in the description are never sent.
 */
export function formValues(fields: readonly FormField[], data: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const field of fields) {
    const name = inputName(field);
    if ((field.kind === 'select' || field.kind === 'file') && field.multiple) {
      const chosen = data.getAll(name).filter((value): value is string => typeof value === 'string' && value !== '');
      if (chosen.length) values[field.name] = chosen;
      continue;
    }
    const value = data.get(name);
    if (typeof value !== 'string') continue;
    const text = field.kind === 'password' ? value : value.trim();
    if (text !== '') values[field.name] = text;
  }
  return values;
}

/** Only the plain-text values (a contact message has no lists). */
export function textValues(values: Record<string, string | string[]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) if (typeof value === 'string') result[name] = value;
  return result;
}

/** What a form shows after the API answered. */
export interface ContentFormState {
  ok?: boolean;
  /** The backend's message ("thank you", or what went wrong). */
  message?: string;
  /** Per field, the backend's first message, keyed by the field's name. */
  fieldErrors?: Record<string, string>;
  /** What the shopper typed, so a refused form keeps it (never passwords or file ids). */
  values?: Record<string, string | string[]>;
}

/** The `type` / `inputMode` / `autoComplete` of a text-like field kind; unknown kinds are text. */
export function inputAttributes(kind: string): { type: string; inputMode?: 'tel' | 'email'; autoComplete?: string } {
  switch (kind) {
    case 'email':
      return { type: 'email', inputMode: 'email', autoComplete: 'email' };
    case 'phone':
      return { type: 'tel', inputMode: 'tel', autoComplete: 'tel' };
    case 'password':
      return { type: 'password', autoComplete: 'current-password' };
    case 'date':
      return { type: 'date' };
    default:
      return { type: 'text' };
  }
}
