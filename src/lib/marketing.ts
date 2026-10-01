/**
 * Browser marketing events (GA4 ecommerce on `dataLayer` / gtag, Meta `fbq`, TikTok `ttq`,
 * Snapchat `snaptr`) and their server-side twin (POST /events through our route handler).
 *
 * Client-safe: no secrets, no environment variables. The ONE place in the UI that may read the
 * number of a Price / Money (`amount`), and only to put it in an analytics payload exactly as the
 * backend sent it: no arithmetic, no formatting, never on screen (see the `Money` description in
 * the contract). Pixels are installed by <MarketingTags> from `Layout.marketing`; an event for a
 * pixel that is not installed is simply not sent.
 */
import type { Checkout, CheckoutResult, EventName, Locale, Marketing, Price, ProductCard, ProductDetails } from '@/sdk';
import { EVENTS_ENDPOINT } from './routing';

/** GA4 recommended ecommerce events this storefront fires. */
export type BrowserEventName =
  | 'view_item'
  | 'view_item_list'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'add_payment_info'
  | 'purchase'
  | 'search'
  | 'sign_up'
  | 'login'
  | 'add_to_wishlist'
  | 'select_promotion';

export interface MarketingItem {
  id: number | null;
  name: string;
  brand?: string | null;
  /** Price.amount as the backend sent it (for analytics only). */
  price?: number | null;
  currency?: string | null;
  quantity?: number;
}

export interface MarketingEvent {
  name: BrowserEventName;
  /** Shared by the browser pixel and the server event so the platforms de-duplicate them. */
  eventId?: string;
  items?: MarketingItem[];
  /** A total the backend computed (Money.amount / Price.amount), never one computed here. */
  value?: number | null;
  currency?: string | null;
  searchTerm?: string | null;
  /** Order.id (purchase). */
  orderId?: string | null;
  /** Order.number, shown to GA as transaction_id. */
  transactionId?: string | null;
}

interface Pixels {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (...args: unknown[]) => void };
  snaptr?: (...args: unknown[]) => void;
}

/** Events the backend accepts (contract EventRequest.name). */
const SERVER_EVENTS: readonly EventName[] = ['page_view', 'view_item', 'view_item_list', 'search', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'sign_up', 'login', 'add_to_wishlist', 'select_promotion'];

/** Standard event names per platform (none → the platform is not told). */
const META: Partial<Record<BrowserEventName, string>> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  add_to_wishlist: 'AddToWishlist',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  search: 'Search',
  sign_up: 'CompleteRegistration',
};
const TIKTOK: Partial<Record<BrowserEventName, string>> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  add_to_wishlist: 'AddToWishlist',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'CompletePayment',
  search: 'Search',
  sign_up: 'CompleteRegistration',
};
const SNAPCHAT: Partial<Record<BrowserEventName, string>> = {
  view_item: 'VIEW_CONTENT',
  add_to_cart: 'ADD_CART',
  add_to_wishlist: 'ADD_TO_WISHLIST',
  begin_checkout: 'START_CHECKOUT',
  add_payment_info: 'ADD_BILLING',
  purchase: 'PURCHASE',
  search: 'SEARCH',
  sign_up: 'SIGN_UP',
};
/** Google Ads conversion label keys (Layout.marketing.googleAds.labels) per event. */
const GOOGLE_ADS: Partial<Record<BrowserEventName, string>> = {
  purchase: 'purchase',
  add_to_cart: 'add_to_cart',
  view_item: 'view_item',
  begin_checkout: 'begin_checkout',
  add_payment_info: 'add_payment_info',
};

let configured: Marketing | null = null;

/** Called by <MarketingTags> once the tags are installed (Google Ads ids and labels live here). */
export function configureMarketing(marketing: Marketing | null): void {
  configured = marketing;
}

function pixels(): Pixels | null {
  return typeof window === 'undefined' ? null : (window as unknown as Pixels);
}

/** A fresh event id (browser and server share it for de-duplication). */
export function newEventId(name: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${name}-${random}`;
}

function priceNumber(price: Price | null | undefined): number | null {
  return price ? price.amount : null;
}

/** A product card as an analytics item (the backend's price number, untouched). */
export function itemFromCard(card: ProductCard, quantity = 1): MarketingItem {
  return { id: card.id, name: card.name, brand: card.brand?.name ?? null, price: priceNumber(card.price), currency: card.price?.currency ?? null, quantity };
}

/** `view_item` of a product page. */
export function viewItemEvent(details: ProductDetails): MarketingEvent {
  const item = itemFromCard(details.product);
  return { name: 'view_item', items: [item], value: item.price, currency: item.currency };
}

/** `view_item_list` / `search` of a listing page (no value: a list has no total). */
export function listEvent(name: 'view_item_list' | 'search', cards: readonly ProductCard[], searchTerm: string | null = null): MarketingEvent {
  return { name, items: cards.map((card) => itemFromCard(card)), searchTerm };
}

/** `begin_checkout` of the checkout page: the cart lines (unit price per item) and the checkout total. */
export function beginCheckoutEvent(checkout: Checkout): MarketingEvent {
  const total = checkout.totals.total;
  return {
    name: 'begin_checkout',
    items: checkout.cart.items.map((line) => ({ ...itemFromCard(line.product, line.quantity), price: priceNumber(line.unitPrice) })),
    value: total.amount,
    currency: total.currency,
  };
}

/** `purchase` of the checkout result page: the order total from the backend, the lines by name and quantity. */
export function purchaseEvent(result: CheckoutResult): MarketingEvent | null {
  const order = result.order;
  if (!order || (result.status !== 'placed' && result.status !== 'paid')) return null;
  const total = order.totals.total;
  return {
    name: 'purchase',
    eventId: `purchase-${order.id}`,
    orderId: order.id,
    transactionId: order.number,
    value: total.amount,
    currency: total.currency,
    items: order.items.map((item) => ({ id: null, name: item.name, quantity: item.quantity })),
  };
}

function ga4Items(items: readonly MarketingItem[] = []) {
  return items.map((item, index) => ({
    item_id: item.id === null ? undefined : String(item.id),
    item_name: item.name,
    item_brand: item.brand ?? undefined,
    price: item.price ?? undefined,
    quantity: item.quantity ?? 1,
    index,
  }));
}

/** Pushes the event to every installed pixel. Never throws (a blocked pixel must not break the page). */
export function fireBrowserEvent(event: MarketingEvent): string {
  const eventId = event.eventId ?? newEventId(event.name);
  const w = pixels();
  if (!w) return eventId;
  const ids = (event.items ?? []).map((item) => (item.id === null ? item.name : String(item.id)));
  const common = { value: event.value ?? undefined, currency: event.currency ?? undefined };
  try {
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ ecommerce: null });
      w.dataLayer.push({
        event: event.name,
        event_id: eventId,
        search_term: event.searchTerm ?? undefined,
        ecommerce: { ...common, transaction_id: event.transactionId ?? undefined, items: ga4Items(event.items) },
      });
    }
    // GA4 through gtag.js (stores without GTM): gtag ignores the GTM-style objects above.
    if (configured?.googleAnalyticsIds.length && w.gtag) {
      w.gtag('event', event.name, { ...common, event_id: eventId, transaction_id: event.transactionId ?? undefined, search_term: event.searchTerm ?? undefined, items: ga4Items(event.items) });
    }
    const label = GOOGLE_ADS[event.name] && configured?.googleAds?.labels[GOOGLE_ADS[event.name] as string];
    if (label && configured?.googleAds && w.gtag) {
      w.gtag('event', 'conversion', { send_to: [configured.googleAds.conversionId, label].join('/'), ...common, transaction_id: event.transactionId ?? undefined });
    }
    const meta = META[event.name];
    if (meta && w.fbq) w.fbq('track', meta, { ...common, content_ids: ids, content_type: 'product', search_string: event.searchTerm ?? undefined }, { eventID: eventId });
    const tiktok = TIKTOK[event.name];
    if (tiktok && w.ttq) w.ttq.track(tiktok, { ...common, contents: (event.items ?? []).map((item, i) => ({ content_id: ids[i], content_name: item.name, quantity: item.quantity ?? 1, price: item.price ?? undefined })), query: event.searchTerm ?? undefined }, { event_id: eventId });
    const snap = SNAPCHAT[event.name];
    if (snap && w.snaptr) w.snaptr('track', snap, { price: event.value ?? undefined, currency: event.currency ?? undefined, item_ids: ids, transaction_id: event.transactionId ?? undefined, client_dedup_id: eventId, search_string: event.searchTerm ?? undefined });
  } catch {
    /* a pixel failed: analytics never break the page */
  }
  return eventId;
}

/** What our route handler forwards to POST /events: ids only (the backend looks up names and prices). */
export interface ServerEventBody {
  locale: Locale;
  name: EventName;
  eventId: string;
  productIds?: number[];
  orderId?: string | null;
  searchTerm?: string | null;
  page?: { path: string; referrer: string | null };
}

/** Sends the server-side twin of an event with sendBeacon (survives navigation; fire and forget). */
export function sendServerEvent(body: ServerEventBody): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
  try {
    return navigator.sendBeacon(EVENTS_ENDPOINT, new Blob([JSON.stringify(body)], { type: 'application/json' }));
  } catch {
    return false;
  }
}

/** Fires the browser pixels and the server event with one event id. Returns the id. */
export function track(locale: Locale, event: MarketingEvent): string {
  const eventId = fireBrowserEvent(event);
  if ((SERVER_EVENTS as readonly string[]).includes(event.name)) {
    const productIds = (event.items ?? []).map((item) => item.id).filter((id): id is number => typeof id === 'number');
    sendServerEvent({
      locale,
      name: event.name as EventName,
      eventId,
      productIds: productIds.length ? productIds.slice(0, 50) : undefined,
      orderId: event.orderId ?? null,
      searchTerm: event.searchTerm ?? null,
      page: typeof location === 'undefined' ? undefined : { path: location.pathname + location.search, referrer: document.referrer || null },
    });
  }
  return eventId;
}

/** Purchase fires once per checkout reference in this browser tab session (reloads and back/forward included). */
export function trackPurchaseOnce(locale: Locale, reference: string, event: MarketingEvent): boolean {
  const key = `sc_purchase_${reference}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    /* storage blocked: the backend still de-duplicates by eventId */
  }
  track(locale, event);
  return true;
}
