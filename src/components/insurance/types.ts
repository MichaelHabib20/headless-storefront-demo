import type { InsurancePage, Locale } from '@/sdk';

/** What saving a profile answers to the page: the backend's message and page, or its reasons per field. */
export interface InsuranceFormState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** What the customer typed before a refused save (never the numbers they typed: those are typed again). */
  values?: Record<string, string>;
  page?: InsurancePage;
}

export type SaveInsuranceAction = (state: InsuranceFormState, form: FormData) => Promise<InsuranceFormState>;

export type DeleteInsuranceAction = (locale: Locale, id: string) => Promise<{ ok: true; message: string; page: InsurancePage } | { ok: false; message: string }>;
