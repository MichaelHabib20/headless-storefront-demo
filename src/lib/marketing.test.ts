/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Marketing } from '@/sdk';
import { checkoutFixture, checkoutResultFixture } from '@/test/checkout-fixtures';
import { productsFixture } from '@/test/fixtures';
import { productFixture } from '@/test/product-fixtures';
import { beginCheckoutEvent, configureMarketing, fireBrowserEvent, itemFromCard, listEvent, purchaseEvent, track, trackPurchaseOnce, viewItemEvent } from './marketing';

type Win = Window & { dataLayer?: unknown[]; gtag?: unknown; fbq?: unknown; ttq?: unknown; snaptr?: unknown };
const win = window as Win;

const MARKETING: Marketing = {
  gtmId: 'GTM-X',
  googleAnalyticsIds: ['G-X'],
  googleAds: { conversionId: 'AW-1', labels: { purchase: 'buy' } },
  facebookPixelId: '1',
  tiktokPixelId: 'T',
  snapchatPixelId: 'S',
  clarityId: null,
  hotjarId: null,
};

let beacons: { url: string; body: unknown }[];

beforeEach(() => {
  beacons = [];
  win.dataLayer = [];
  win.gtag = vi.fn();
  win.fbq = vi.fn();
  win.ttq = { track: vi.fn() };
  win.snaptr = vi.fn();
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn((url: string, blob: Blob) => {
      void blob.text().then((text) => beacons.push({ url, body: JSON.parse(text) }));
      return true;
    }),
  });
  sessionStorage.clear();
  configureMarketing(MARKETING);
});

afterEach(() => {
  configureMarketing(null);
  delete win.dataLayer;
  delete win.gtag;
  delete win.fbq;
  delete win.ttq;
  delete win.snaptr;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('analytics payloads use the backend numbers as they are', () => {
  it('view_item of a product page', () => {
    const details = productFixture('ar');
    const event = viewItemEvent(details);
    expect(event).toEqual({ name: 'view_item', items: [itemFromCard(details.product)], value: details.product.price?.amount, currency: details.product.price?.currency });
    expect(event.items![0]).toMatchObject({ id: details.product.id, name: details.product.name, quantity: 1 });
  });

  it('begin_checkout carries the checkout total and the unit prices, purchase the order total', () => {
    const checkout = checkoutFixture('en');
    const begin = beginCheckoutEvent(checkout);
    expect(begin.value).toBe(checkout.totals.total.amount);
    expect(begin.items).toHaveLength(checkout.cart.items.length);
    expect(begin.items![0].price).toBe(checkout.cart.items[0].unitPrice.amount);
    expect(begin.items![0].quantity).toBe(checkout.cart.items[0].quantity);

    const result = checkoutResultFixture('placed', 'ar');
    const purchase = purchaseEvent(result)!;
    expect(purchase).toMatchObject({ name: 'purchase', eventId: `purchase-${result.order!.id}`, orderId: result.order!.id, transactionId: result.order!.number, value: result.order!.totals.total.amount });
    expect(purchaseEvent(checkoutResultFixture('pending'))).toBeNull();
    expect(purchaseEvent(checkoutResultFixture('failed'))).toBeNull();
  });

  it('a list event has items and no value (a list has no total)', () => {
    const event = listEvent('search', productsFixture('en').items, 'baby');
    expect(event.value).toBeUndefined();
    expect(event.searchTerm).toBe('baby');
  });
});

describe('fireBrowserEvent', () => {
  it('pushes GA4 ecommerce to dataLayer and gtag, and the standard events to Meta, TikTok and Snapchat, with one event id', () => {
    const id = fireBrowserEvent({ name: 'purchase', eventId: 'purchase-9', value: 196, currency: 'EGP', transactionId: '48213', items: [{ id: 7, name: 'A', price: 18, quantity: 2 }] });

    expect(id).toBe('purchase-9');
    expect(win.dataLayer).toEqual([
      { ecommerce: null },
      { event: 'purchase', event_id: 'purchase-9', search_term: undefined, ecommerce: { value: 196, currency: 'EGP', transaction_id: '48213', items: [{ item_id: '7', item_name: 'A', item_brand: undefined, price: 18, quantity: 2, index: 0 }] } },
    ]);
    expect(win.gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({ value: 196, event_id: 'purchase-9' }));
    expect(win.gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({ send_to: 'AW-1/buy', value: 196 }));
    expect(win.fbq).toHaveBeenCalledWith('track', 'Purchase', expect.objectContaining({ value: 196, currency: 'EGP', content_ids: ['7'] }), { eventID: 'purchase-9' });
    expect((win.ttq as { track: ReturnType<typeof vi.fn> }).track).toHaveBeenCalledWith('CompletePayment', expect.objectContaining({ value: 196 }), { event_id: 'purchase-9' });
    expect(win.snaptr).toHaveBeenCalledWith('track', 'PURCHASE', expect.objectContaining({ transaction_id: '48213', client_dedup_id: 'purchase-9' }));
  });

  it('tells nobody about events a platform has no name for, and never throws', () => {
    fireBrowserEvent({ name: 'view_item_list', items: [] });
    expect(win.fbq).not.toHaveBeenCalled();
    expect(win.gtag).not.toHaveBeenCalledWith('event', 'conversion', expect.anything());

    win.fbq = () => {
      throw new Error('blocked');
    };
    expect(() => fireBrowserEvent({ name: 'add_to_cart' })).not.toThrow();
    delete win.dataLayer;
    expect(() => fireBrowserEvent({ name: 'search', searchTerm: 'x' })).not.toThrow();
  });

  it('without configured ids only the GTM dataLayer is used', () => {
    configureMarketing(null);
    fireBrowserEvent({ name: 'view_item', items: [] });
    expect(win.gtag).not.toHaveBeenCalled();
    expect(win.dataLayer).toHaveLength(2);
  });
});

describe('track', () => {
  it('sends the server twin with ids only and the same event id', async () => {
    history.replaceState(null, '', '/en/p/x?y=1');
    const id = track('en', { name: 'add_to_cart', items: [{ id: 9822, name: 'B', price: 18 }, { id: null, name: 'no id' }] });
    await flush();

    expect(beacons).toEqual([{ url: '/api/events', body: { locale: 'en', name: 'add_to_cart', eventId: id, productIds: [9822], orderId: null, searchTerm: null, page: { path: '/en/p/x?y=1', referrer: null } } }]);
    expect(Object.keys(beacons[0].body as object)).not.toContain('value');
  });

  it('fires the purchase once per checkout reference', async () => {
    const event = purchaseEvent(checkoutResultFixture('placed'))!;
    expect(trackPurchaseOnce('en', 'ref-1', event)).toBe(true);
    expect(trackPurchaseOnce('en', 'ref-1', event)).toBe(false);
    expect(trackPurchaseOnce('en', 'ref-2', event)).toBe(true);
    await flush();
    expect(beacons.map((b) => (b.body as { eventId: string }).eventId)).toEqual([event.eventId, event.eventId]);
  });
});
