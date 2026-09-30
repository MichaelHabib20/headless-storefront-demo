/**
 * Store settings the checkout and address pages are drawn from (contract: contract/openapi.yaml).
 * Public: no shopper token needed.
 */
import type { StorefrontClient } from './http';
import type { CheckoutSettings, Locale, Locations } from './types';

/** What this store's checkout supports and how its address form looks. */
export const getCheckoutSettings = (client: StorefrontClient, locale: Locale) => client.get<CheckoutSettings>('checkout/settings', locale);

/** Cities → areas → districts for the address form. */
export const getLocations = (client: StorefrontClient, locale: Locale) => client.get<Locations>('locations', locale);
