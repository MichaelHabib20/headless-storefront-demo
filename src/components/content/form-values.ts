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

/**
 * phase B: whether a field is shown (and sent) now. `showWhen` is the backend's: every condition must
 * hold — the named field's current value is one of `values`. A field without `showWhen` always shows.
 */
export function fieldShown(field: Pick<FormField, 'showWhen'>, current: Readonly<Record<string, string>>): boolean {
  return (field.showWhen ?? []).every((condition) => condition.values.includes(current[condition.field] ?? ''));
}

/**
 * Whether the shopper must fill a field before sending: the backend's `required`, or the only field
 * shown (an answer with nothing in it says nothing — e.g. a prescriptions form whose one upload the
 * merchant left optional).
 */
export function mustFill(field: Pick<FormField, 'required'>, shown: readonly unknown[]): boolean {
  return field.required || shown.length === 1;
}

export interface FormCheckMessages {
  required: string;
  /** For an empty file field. */
  attach: string;
  /** An e-mail field whose text has no address shape. */
  email: string;
  /** Nothing at all was filled in a form whose fields are all optional. */
  empty: string;
}

/**
 * Checks made before a backend-described form is sent, so every simple mistake shows at once: each
 * field the shopper must fill (`mustFill`) and is empty gets a message, and a form with nothing at
 * all filled in is not sent. The backend still validates everything else.
 */
export function checkForm(fields: readonly FormField[], data: FormData, messages: FormCheckMessages): Pick<ContentFormState, 'fieldErrors' | 'message'> {
  const current: Record<string, string> = {};
  for (const field of fields) {
    const value = data.get(inputName(field));
    current[field.name] = typeof value === 'string' ? value : '';
  }
  const shown = fields.filter((field) => fieldShown(field, current));
  const values = formValues(shown, data);
  const fieldErrors: Record<string, string> = {};
  for (const field of shown) {
    const value = values[field.name];
    if (mustFill(field, shown) && value === undefined) fieldErrors[field.name] = field.kind === 'file' ? messages.attach : messages.required;
    else if (field.kind === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fieldErrors[field.name] = messages.email;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (shown.length && !Object.keys(values).length) return { message: messages.empty };
  return {};
}

/** The starting values of the select fields other fields depend on: what was typed before, else the backend's `selected` option. */
export function watchedValues(fields: readonly FormField[], values: Readonly<Record<string, string | string[]>> = {}): Record<string, string> {
  const watched = new Set(fields.flatMap((field) => (field.showWhen ?? []).map((condition) => condition.field)));
  const current: Record<string, string> = {};
  for (const field of fields) {
    if (!watched.has(field.name)) continue;
    const typed = values[field.name];
    current[field.name] = typeof typed === 'string' ? typed : (field.options.find((option) => option.selected)?.value ?? '');
  }
  return current;
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
