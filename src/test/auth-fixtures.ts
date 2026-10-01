/**
 * API answers for the auth and profile pages, generated from the contract-checked mock by
 * `node scripts/build-auth-fixtures.mjs` until they are recorded live.
 */
import type { AuthSettings, Locale, Profile, Session } from '@/sdk';
import settingsFullAr from './fixtures/v3/auth-settings-full.ar.json';
import settingsFullEn from './fixtures/v3/auth-settings-full.en.json';
import settingsAr from './fixtures/v3/auth-settings.ar.json';
import settingsEn from './fixtures/v3/auth-settings.en.json';
import profileAr from './fixtures/v3/profile.ar.json';
import profileEn from './fixtures/v3/profile.en.json';
import sessionAr from './fixtures/v3/session.ar.json';
import sessionEn from './fixtures/v3/session.en.json';

type ByLocale = Record<Locale, { data: unknown }>;
const pick = <T,>(files: ByLocale, locale: Locale): T => structuredClone(files[locale].data) as T;

/** The staging-like store: phone login, sign-up with first/last name, phone, optional e-mail, password, birthdate; SMS reset; no social, no OTP. */
export const authSettingsFixture = (locale: Locale = 'en') => pick<AuthSettings>({ en: settingsEn, ar: settingsAr }, locale);
/** Everything on: OTP, Google + Facebook, e-mail reset, referral code, customer group select, approval, verify after sign-up. */
export const fullAuthSettingsFixture = (locale: Locale = 'en') => pick<AuthSettings>({ en: settingsFullEn, ar: settingsFullAr }, locale);
/** The seeded customer signed in (`next: null`). */
export const sessionFixture = (locale: Locale = 'en') => pick<Session>({ en: sessionEn, ar: sessionAr }, locale);
/** The seeded customer's profile: phone is the identifier (not editable), e-mail optional, birthdate. */
export const profileFixture = (locale: Locale = 'en') => pick<Profile>({ en: profileEn, ar: profileAr }, locale);
