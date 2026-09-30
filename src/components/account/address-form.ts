import type { Address, AddressFormField, CheckoutSettings, Locations } from '@/sdk';

/**
 * The address form is drawn from `CheckoutSettings.addressForm` (location pickers + text fields,
 * in the API's order). The storefront has no address field list of its own: these helpers only
 * turn the API's description into inputs, and the API's 422 `fields` back into messages.
 */
export type AddressForm = CheckoutSettings['addressForm'];

/** Location levels this storefront can draw, and the `AddressInput` property each one fills. */
export type Level = 'city' | 'area' | 'district';
export const LEVEL_INPUTS: Record<Level, 'cityId' | 'areaId' | 'districtId'> = { city: 'cityId', area: 'areaId', district: 'districtId' };

/** Text inputs are named `field.<name>` so they can't clash with the form's own inputs. */
export const FIELD_PREFIX = 'field.';

export interface LocationSelection {
  cityId: number | null;
  areaId: number | null;
  districtId: number | null;
}

export interface Option {
  id: number;
  name: string;
}

/** The levels the API lists, in its order; a level this storefront doesn't know is skipped. */
export function formLevels(form: AddressForm): Level[] {
  return form.levels.filter((level): level is Level => Object.hasOwn(LEVEL_INPUTS, level));
}

/** What an address already has chosen (edit), or nothing (new). */
export function selectionOf(address: Address | null | undefined): LocationSelection {
  return { cityId: address?.city.id ?? null, areaId: address?.area?.id ?? null, districtId: address?.district?.id ?? null };
}

/**
 * The choices of one level for what is chosen above it: all cities; the areas of the chosen
 * city; the districts of the chosen area (or of the whole city when the store shows no area picker).
 */
export function levelOptions(locations: Locations, level: Level, selection: LocationSelection, levels: Level[]): Option[] {
  const pick = ({ id, name }: Option) => ({ id, name });
  if (level === 'city') return locations.cities.map(pick);
  const city = locations.cities.find((c) => c.id === selection.cityId);
  if (!city) return [];
  if (level === 'area') return city.areas.map(pick);
  if (!levels.includes('area')) return city.areas.flatMap((area) => area.districts.map(pick));
  return city.areas.find((a) => a.id === selection.areaId)?.districts.map(pick) ?? [];
}

/** A new choice on one level clears the levels below it. */
export function choose(selection: LocationSelection, level: Level, id: number | null): LocationSelection {
  if (level === 'city') return { cityId: id, areaId: null, districtId: null };
  if (level === 'area') return { ...selection, areaId: id, districtId: null };
  return { ...selection, districtId: id };
}

/** Input attributes for a field `kind`; unknown kinds are plain text (the contract only grows). */
export function inputAttributes(kind: AddressFormField['kind'] | string): { type: 'text' | 'tel' | 'email'; autoComplete?: string; inputMode?: 'tel' | 'email' } {
  if (kind === 'phone') return { type: 'tel', autoComplete: 'tel', inputMode: 'tel' };
  if (kind === 'email') return { type: 'email', autoComplete: 'email', inputMode: 'email' };
  return { type: 'text' };
}

/** The API's message for an input, by the names the API uses (`street`, or `values.street`; `areaId`). */
export function errorFor(errors: Record<string, string>, name: string): string | undefined {
  return errors[name] ?? errors[`values.${name}`];
}

/** Messages the API sent for names this form has no input for: shown in the general message. */
export function unmatchedErrors(errors: Record<string, string>, form: AddressForm): string[] {
  const known = new Set<string>();
  for (const level of formLevels(form)) known.add(LEVEL_INPUTS[level]);
  for (const field of form.fields) known.add(field.name).add(`values.${field.name}`);
  return Object.entries(errors)
    .filter(([name]) => !known.has(name))
    .map(([, message]) => message);
}

/** The text values of a submitted form, by the API's field names; an empty value is sent as null. */
export function valuesFromForm(formData: FormData): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(FIELD_PREFIX) || typeof value !== 'string') continue;
    const name = key.slice(FIELD_PREFIX.length);
    if (name) values[name] = value.trim() || null;
  }
  return values;
}

/** A positive whole id from a form value, or null. */
export function idFromForm(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && Number.isSafeInteger(id) ? id : null;
}
