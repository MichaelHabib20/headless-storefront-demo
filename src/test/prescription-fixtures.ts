/**
 * Prescription answers used by tests, generated from the contract-checked mock
 * (`node scripts/build-prescription-fixtures.mjs`; `npm run contract:check` validates them).
 */
import type { Locale, PrescriptionForm, PrescriptionsPage } from '@/sdk';
import blockedAr from './fixtures/v3/prescription-form-blocked.ar.json';
import blockedEn from './fixtures/v3/prescription-form-blocked.en.json';
import formAr from './fixtures/v3/prescription-form.ar.json';
import formEn from './fixtures/v3/prescription-form.en.json';
import listAr from './fixtures/v3/prescriptions.ar.json';
import listEn from './fixtures/v3/prescriptions.en.json';

/** The seeded customer's form: one kind, images required, an address, nothing blocking. */
export const prescriptionFormFixture = (locale: Locale = 'en') => structuredClone((locale === 'ar' ? formAr : formEn).data) as PrescriptionForm;
/** Wasfaty offered (a `type` select) and the phone not verified (blocker `verify_phone`). */
export const blockedPrescriptionFormFixture = (locale: Locale = 'en') => structuredClone((locale === 'ar' ? blockedAr : blockedEn).data) as PrescriptionForm;
/** #1042 received (can be cancelled), #1041 being prepared. */
export const prescriptionsFixture = (locale: Locale = 'en') => structuredClone((locale === 'ar' ? listAr : listEn).data) as PrescriptionsPage;
