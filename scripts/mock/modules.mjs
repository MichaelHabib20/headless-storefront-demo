/**
 * The mock v3 API is built from modules, one file per area of the contract. Each module is
 * created with the shopper store (same sessions, carts and products) and returns:
 *
 *   handle({ method, pathname, query, token, locale, body, contentType, headers, raw }) → [status, payload, responseHeaders?] | null
 *   reset()  (optional) → back to the seeded state
 *   intercept({ method, pathname, query, token, locale, headers }) (optional) → asked first, before the
 *     recorded layout / home and before the request body is read (shell: maintenance, layout modes, Me.area)
 *   mode(body) (optional) → receives POST /__mode; returns the module's switches
 *
 * `null` means "not mine": the next module is asked, and at the end the shopper store
 * (session, me, cart, wishlist, compare, notifications). Every answer must match the contract:
 * test it like scripts/mock-shopper.test.mjs does.
 */
import { createAccountModule } from './account.mjs';
import { createCatalogModule } from './catalog.mjs';
import { createCheckoutModule } from './checkout.mjs';
import { createProductModule } from './product.mjs';
import { createSettingsModule } from './settings.mjs';
import { createContentModule } from './content.mjs';
import { createShellModule } from './shell.mjs';

const FACTORIES = [createSettingsModule, createProductModule, createCatalogModule, createCheckoutModule, createAccountModule, createContentModule, createShellModule];

export function createModules(shopper) {
  return FACTORIES.map((create) => create(shopper));
}
