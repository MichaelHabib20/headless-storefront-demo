/**
 * The mock v3 API is built from modules, one file per area of the contract. Each module is
 * created with the shopper store (same sessions, carts and products) and returns:
 *
 *   handle({ method, pathname, query, token, locale, body, contentType }) → [status, payload] | null
 *   reset()  (optional) → back to the seeded state
 *
 * `null` means "not mine": the next module is asked, and at the end the shopper store
 * (session, me, cart, wishlist, compare, notifications). Every answer must match the contract:
 * test it like scripts/mock-shopper.test.mjs does.
 */
import { createCatalogModule } from './catalog.mjs';
import { createSettingsModule } from './settings.mjs';

const FACTORIES = [createSettingsModule, createCatalogModule];

export function createModules(shopper) {
  return FACTORIES.map((create) => create(shopper));
}
