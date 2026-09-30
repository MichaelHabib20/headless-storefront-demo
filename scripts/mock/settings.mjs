/**
 * Mock module: what the store's checkout supports and its locations. Static, no token needed.
 *   GET /checkout/settings → CheckoutSettingsResponse
 *   GET /locations         → LocationsResponse
 * The address form and the cities are the ones in account-state.mjs, so the addresses the other
 * modules keep always fit this form.
 */
import { ADDRESS_FIELDS, CITIES } from './account-state.mjs';

const TEXT = {
  en: { pickupLabel: 'Click & Collect', notice: 'Orders placed before 6 pm are delivered the same day.' },
  ar: { pickupLabel: 'استلم من الفرع', notice: 'الطلبات قبل الساعة 6 مساءً يتم توصيلها في نفس اليوم.' },
};

export function checkoutSettings(locale) {
  return {
    guestCheckout: true,
    guestEmail: 'optional',
    pickup: { enabled: true, label: TEXT[locale].pickupLabel },
    promoCode: true,
    orderNote: true,
    notice: TEXT[locale].notice,
    addressForm: {
      levels: ['city', 'area'],
      fields: ADDRESS_FIELDS.map((field) => ({ name: field.name, label: field.label[locale], required: field.required, kind: field.kind })),
    },
  };
}

export function locations(locale) {
  return {
    cities: CITIES.map((city) => ({
      id: city.id,
      name: city.name[locale],
      areas: city.areas.map((area) => ({
        id: area.id,
        name: area.name[locale],
        districts: area.districts.map((district) => ({ id: district.id, name: district.name[locale] })),
      })),
    })),
  };
}

export function createSettingsModule() {
  return {
    handle({ method, pathname, locale }) {
      if (method !== 'GET') return null;
      if (pathname === '/checkout/settings') return [200, { data: checkoutSettings(locale) }];
      if (pathname === '/locations') return [200, { data: locations(locale) }];
      return null;
    },
  };
}
