/**
 * Public v3 types, generated from contract/openapi.yaml (`npm run contract:types`).
 * Never edit src/sdk/generated/api.ts by hand.
 */
import type { components } from '../generated/api';

type Schemas = components['schemas'];

export type Locale = Schemas['Locale'];
export type Target = Schemas['Target'];
export type TargetType = Target['type'];
export type Layout = Schemas['Layout'];
export type NavItem = Schemas['NavItem'];
export type Link = Schemas['Link'];
export type Home = Schemas['Home'];
export type Section = Schemas['Section'];
export type SectionLayout = Schemas['SectionLayout'];
export type Banner = Schemas['Banner'];
export type PromoBanner = Schemas['PromoBanner'];
export type Popup = Schemas['Popup'];
export type Tile = Schemas['Tile'];
export type ProductCard = Schemas['ProductCard'];
export type Price = Schemas['Price'];
export type ResponsiveImage = Schemas['ResponsiveImage'];
export type Image = Schemas['Image'];

export const LOCALES = ['en', 'ar'] as const satisfies readonly Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
