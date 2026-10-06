/**
 * Insurance answers used by tests, generated from the contract-checked mock
 * (`node scripts/build-insurance-fixtures.mjs`; `npm run contract:check` validates them).
 */
import type { InsurancePage, Locale, PrescriptionForm } from '@/sdk';
import formAr from './fixtures/v3/prescription-form-insurance.ar.json';
import formEn from './fixtures/v3/prescription-form-insurance.en.json';
import pageAr from './fixtures/v3/insurance.ar.json';
import pageEn from './fixtures/v3/insurance.en.json';

const pick = <T>(locale: Locale, ar: { data: unknown }, en: { data: unknown }) => structuredClone((locale === 'ar' ? ar : en).data) as T;

/** One profile (Misr Insurance — Mona Ali); the form asks the national ID as a number and the card as photos. */
export const insurancePageFixture = (locale: Locale = 'en') => pick<InsurancePage>(locale, pageAr, pageEn);
/** The prescription form of a store with insurance: `type` cash / insurance and the insurance fields (`showWhen`). */
export const insurancePrescriptionFormFixture = (locale: Locale = 'en') => pick<PrescriptionForm>(locale, formAr, formEn);
