/**
 * Mock state shared by the checkout module and the account module: the shopper's address book
 * and orders live on the shopper session (scripts/mock/shopper.mjs), so an address added on the
 * addresses page shows up in checkout, and an order placed in checkout shows up in the orders list.
 *
 * Test scaffolding only: the real rules live in the backend.
 */

/** Cities → areas → districts of the mock store (`GET /locations`). */
export const CITIES = [
  {
    id: 1,
    name: { en: 'Cairo', ar: 'القاهرة' },
    areas: [
      { id: 11, name: { en: 'Nasr City', ar: 'مدينة نصر' }, districts: [] },
      { id: 12, name: { en: 'Maadi', ar: 'المعادي' }, districts: [] },
    ],
  },
  {
    id: 2,
    name: { en: 'Giza', ar: 'الجيزة' },
    areas: [
      { id: 21, name: { en: 'Dokki', ar: 'الدقي' }, districts: [] },
      // the mock store does not deliver here: addresses in this area have `deliverable: false`
      { id: 22, name: { en: 'Remote Oasis', ar: 'الواحة البعيدة' }, districts: [] },
    ],
  },
];

export const UNDELIVERABLE_AREA_ID = 22;

/** Text inputs of the mock store's address form (`CheckoutSettings.addressForm.fields`). */
export const ADDRESS_FIELDS = [
  { name: 'label', label: { en: 'Address name', ar: 'اسم العنوان' }, required: false, kind: 'text' },
  { name: 'street', label: { en: 'Street', ar: 'الشارع' }, required: true, kind: 'text' },
  { name: 'building', label: { en: 'Building', ar: 'المبنى' }, required: true, kind: 'text' },
  { name: 'floor', label: { en: 'Floor', ar: 'الدور' }, required: false, kind: 'text' },
  { name: 'apartment', label: { en: 'Apartment', ar: 'الشقة' }, required: false, kind: 'text' },
  { name: 'phone', label: { en: 'Phone', ar: 'رقم الهاتف' }, required: true, kind: 'phone' },
];

const SEEDED_ADDRESS = {
  id: 501,
  isDefault: true,
  cityId: 1,
  areaId: 11,
  districtId: null,
  values: { label: 'Home', street: '12 Abbas El Akkad St', building: '12', floor: '3', apartment: '7', phone: '01000000001' },
};

let nextAddressId = 600;

/** A new id for an address row (the real backend also gives a new id when an address is edited). */
export const newAddressId = () => ++nextAddressId;

/**
 * The raw address rows of a session: `{id, isDefault, cityId, areaId, districtId, values}`.
 * The seeded customer starts with one default address; guests start with none.
 * Change the returned array in place (push / splice) to add or remove addresses.
 */
export function addressRows(session) {
  session.addresses ??= session.isGuest ? [] : [structuredClone(SEEDED_ADDRESS)];
  return session.addresses;
}

function place(row) {
  const city = CITIES.find((c) => c.id === row.cityId) ?? null;
  const area = city?.areas.find((a) => a.id === row.areaId) ?? null;
  const district = area?.districts.find((d) => d.id === row.districtId) ?? null;
  return { city, area, district };
}

/** A raw row as the v3 `Address`, or null when its city is unknown. */
export function presentAddress(row, locale) {
  const { city, area, district } = place(row);
  if (!city) return null;
  const ref = (node) => (node ? { id: node.id, name: node.name[locale] } : null);
  const parts = [row.values.building, row.values.street, area?.name[locale], city.name[locale]].filter(Boolean);
  return {
    id: row.id,
    isDefault: Boolean(row.isDefault),
    city: ref(city),
    area: ref(area),
    district: ref(district),
    values: Object.fromEntries(ADDRESS_FIELDS.map((field) => [field.name, row.values[field.name] ?? null])),
    formatted: parts.join(locale === 'ar' ? '، ' : ', '),
    deliverable: row.areaId !== UNDELIVERABLE_AREA_ID,
  };
}

/** The session's address book as v3 `Address[]`, default first. */
export function addressesOf(session, locale) {
  return addressRows(session)
    .map((row) => presentAddress(row, locale))
    .filter(Boolean)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

/**
 * The orders of a session, newest first. Each entry holds the v3 `Order` in both languages:
 * `{ en: Order, ar: Order }` with the same `id`. The checkout module adds one when an order is
 * placed (`orderRows(session).unshift({ en, ar })`); the account module lists, shows and cancels them.
 */
export function orderRows(session) {
  session.orders ??= [];
  return session.orders;
}

let nextOrderNumber = 48210;

/** A new order number and id for a placed order. */
export function newOrderIdentity() {
  const number = String(++nextOrderNumber);
  return { number, id: `mock-order-${number}` };
}

/** Back to the seeded ids (called by the modules' `reset()`). */
export function resetAccountCounters() {
  nextAddressId = 600;
  nextOrderNumber = 48210;
}
