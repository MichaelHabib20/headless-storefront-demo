import { describe, expect, it } from 'vitest';
import { clickIdsCookie, parseClickIds } from './click-ids';
import { eventRequest } from './marketing.server';

describe('campaign click ids', () => {
  it('keeps the click ids of the landing URL, the latest campaign winning', () => {
    expect(clickIdsCookie(new URLSearchParams('utm_source=x'), null)).toBeNull();
    const first = clickIdsCookie(new URLSearchParams('fbclid=IwAR.1&gclid=Cj0_x'), null);
    expect(JSON.parse(first!)).toEqual({ fbclid: 'IwAR.1', gclid: 'Cj0_x' });
    const second = clickIdsCookie(new URLSearchParams('gclid=new&ttclid=tt-1'), first);
    expect(JSON.parse(second!)).toEqual({ fbclid: 'IwAR.1', gclid: 'new', ttclid: 'tt-1' });
  });

  it('drops anything that is not a click id', () => {
    expect(clickIdsCookie(new URLSearchParams('fbclid=<script>'), null)).toBeNull();
    expect(parseClickIds('{"fbclid":"ok","evil":"x","gclid":"a b"}')).toEqual({ fbclid: 'ok' });
    expect(parseClickIds('not json')).toBeNull();
    expect(parseClickIds('null')).toBeNull();
    expect(parseClickIds(undefined)).toBeNull();
  });
});

describe('eventRequest (POST /events body)', () => {
  it('adds the cookies the visitor has and never a price', () => {
    const body = eventRequest(
      { name: 'add_to_cart', eventId: 'e-1', productIds: [9822, -1, 1.5, 7346] },
      { clickIds: '{"fbclid":"fb1"}', fbp: 'fb.1.123', fbc: null },
      'https://shop.test/en/x?y=1',
    );
    expect(body).toEqual({
      name: 'add_to_cart',
      eventId: 'e-1',
      page: { path: '/en/x?y=1', referrer: null },
      clickIds: { fbclid: 'fb1' },
      browser: { fbp: 'fb.1.123', fbc: null },
      productIds: [9822, 7346],
      orderId: null,
      searchTerm: null,
    });
  });

  it('makes an event id when none is given and works without cookies or referer', () => {
    const body = eventRequest({ name: 'purchase', orderId: 'uuid-1', page: { path: '/ar/checkout/final-receipt?checkout=r', referrer: 'https://bank.test/' } }, {}, null);
    expect(body.eventId).toMatch(/^purchase-[0-9a-f-]{36}$/);
    expect(body).toMatchObject({ clickIds: null, browser: null, orderId: 'uuid-1', page: { path: '/ar/checkout/final-receipt?checkout=r', referrer: 'https://bank.test/' } });
    expect(eventRequest({ name: 'login' }, { fbp: '<bad>' }, 'not a url')).toMatchObject({ page: null, browser: null });
  });
});
