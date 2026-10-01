/**
 * Content pages and the shell's personal writes (contract: contract/openapi.yaml): CMS pages,
 * branches, the contact form, landing pages, merchant forms, and the shopper's area.
 * Pages call these through src/lib, never HTTP.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { BranchesPage, ContentPage, FormValues, LandingPage, Locale, Me, MerchantForm, MessageResult } from './types';

const slugPath = (prefix: string, slug: string) => `${prefix}/${encodeURIComponent(slug)}`;

/** A CMS page: `kind` says whether to draw the contact form or the branches too. 404 → ApiError `not_found`. */
export const getPage = (client: StorefrontClient, locale: Locale, slug: string) => client.get<ContentPage>(slugPath('pages', slug), locale);

/** The store's branches, grouped as the merchant grouped them. */
export const getBranches = (client: StorefrontClient, locale: Locale) => client.get<BranchesPage>('branches', locale);

/** Sends the contact form: values keyed by `Page.contact.fields[].name`. 422 → `validation` with `fieldErrors` by field name. */
export const sendContactMessage = (client: StorefrontClient, locale: Locale, values: Record<string, string>) =>
  client.request<MessageResult>('POST', 'contact', { locale, body: { values } });

/** A merchant landing page: home-style sections and promo banners. */
export const getLandingPage = (client: StorefrontClient, locale: Locale, slug: string) => client.get<LandingPage>(slugPath('landing-pages', slug), locale);

/** A merchant form's definition (public). */
export const getForm = (client: StorefrontClient, locale: Locale, slug: string) => client.get<MerchantForm>(slugPath('forms', slug), locale);

/** Answers a merchant form (needs a shopper token; a guest session is enough). A file field sends the id from `POST /uploads`. */
export const submitForm = (client: StorefrontClient, ctx: ShopperContext, slug: string, values: FormValues) =>
  client.request<MessageResult>('POST', `${slugPath('forms', slug)}/responses`, { ...ctx, body: { values } });

/** Chooses the shopper's area (multi-inventory stores); answers `Me` with the new `area`. 422 → the area can't be chosen. */
export const setArea = (client: StorefrontClient, ctx: ShopperContext, areaId: number) => client.request<Me>('PUT', 'me/area', { ...ctx, body: { areaId } });
