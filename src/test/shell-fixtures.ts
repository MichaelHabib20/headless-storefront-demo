/**
 * API answers for the content pages and the shell, generated from the contract-checked mock by
 * `node scripts/build-shell-fixtures.mjs` until the endpoints are live. The shell keys of `Layout`
 * are in the layout fixtures (`layoutFixture`).
 */
import type { BranchesPage, ContentPage, LandingPage, Locale, MerchantForm } from '@/sdk';
import branchesPageAr from './fixtures/v3/content-branches-page.ar.json';
import branchesPageEn from './fixtures/v3/content-branches-page.en.json';
import branchesAr from './fixtures/v3/content-branches.ar.json';
import branchesEn from './fixtures/v3/content-branches.en.json';
import contactAr from './fixtures/v3/content-contact.ar.json';
import contactEn from './fixtures/v3/content-contact.en.json';
import formFileAr from './fixtures/v3/content-form-file.ar.json';
import formFileEn from './fixtures/v3/content-form-file.en.json';
import formAr from './fixtures/v3/content-form.ar.json';
import formEn from './fixtures/v3/content-form.en.json';
import landingAr from './fixtures/v3/content-landing.ar.json';
import landingEn from './fixtures/v3/content-landing.en.json';
import pageAr from './fixtures/v3/content-page.ar.json';
import pageEn from './fixtures/v3/content-page.en.json';

type ByLocale = Record<Locale, { data: unknown }>;
const pick = <T,>(files: ByLocale, locale: Locale): T => structuredClone(files[locale].data) as T;

/** "About Us": a heading, a list, a link (cleaned HTML). */
export const contentPageFixture = (locale: Locale = 'en') => pick<ContentPage>({ en: pageEn, ar: pageAr }, locale);
/** The built-in contact page: hotline, e-mail, WhatsApp and the five contact fields. */
export const contactPageFixture = (locale: Locale = 'en') => pick<ContentPage>({ en: contactEn, ar: contactAr }, locale);
export const branchesPageFixture = (locale: Locale = 'en') => pick<ContentPage>({ en: branchesPageEn, ar: branchesPageAr }, locale);
/** Two groups; Shubra and Master have map links, Maadi has none. */
export const branchesFixture = (locale: Locale = 'en') => pick<BranchesPage>({ en: branchesEn, ar: branchesAr }, locale);
export const landingPageFixture = (locale: Locale = 'en') => pick<LandingPage>({ en: landingEn, ar: landingAr }, locale);
/** "Feedback": text, phone, email, select, multi-select, textarea, file. */
export const merchantFormFixture = (locale: Locale = 'en') => pick<MerchantForm>({ en: formEn, ar: formAr }, locale);
/** "Prescriptions": one required file. */
export const fileFormFixture = (locale: Locale = 'en') => pick<MerchantForm>({ en: formFileEn, ar: formFileAr }, locale);
