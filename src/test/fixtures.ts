/**
 * Real v3 responses recorded from seif-staging (`npm run fixtures:record`).
 * Tests render real data, so they catch mismatches with what the API actually sends.
 */
import type { Home, Layout, Locale } from '@/sdk';
import homeAr from './fixtures/v3/home.ar.json';
import homeEn from './fixtures/v3/home.en.json';
import layoutAr from './fixtures/v3/layout.ar.json';
import layoutEn from './fixtures/v3/layout.en.json';

const homes = { en: homeEn.data, ar: homeAr.data } as unknown as Record<Locale, Home>;
const layouts = { en: layoutEn.data, ar: layoutAr.data } as unknown as Record<Locale, Layout>;

export function homeFixture(locale: Locale = 'en'): Home {
  return structuredClone(homes[locale]);
}

export function layoutFixture(locale: Locale = 'en'): Layout {
  return structuredClone(layouts[locale]);
}
