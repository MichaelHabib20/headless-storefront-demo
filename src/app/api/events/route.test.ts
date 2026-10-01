import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackServerEvent } from '@/lib/marketing.server';
import { POST } from './route';

vi.mock('@/lib/marketing.server', () => ({ trackServerEvent: vi.fn() }));

const post = (body: unknown) => POST(new Request('http://shop.test/api/events', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => vi.mocked(trackServerEvent).mockReset());

describe('POST /api/events (browser → backend events)', () => {
  it('forwards the contract fields the browser may know', async () => {
    const response = await post({ locale: 'ar', name: 'purchase', eventId: 'purchase-u1', orderId: 'u1', productIds: [1, -2, 'x', 3], price: 999, page: { path: '/ar/checkout/result?checkout=r', referrer: 'https://bank.test' } });

    expect(response.status).toBe(204);
    expect(trackServerEvent).toHaveBeenCalledWith('ar', {
      name: 'purchase',
      eventId: 'purchase-u1',
      productIds: [1, 3],
      orderId: 'u1',
      searchTerm: null,
      page: { path: '/ar/checkout/result?checkout=r', referrer: 'https://bank.test' },
    });
  });

  it('never takes another site as the page', async () => {
    await post({ locale: 'en', name: 'view_item', page: { path: '//evil.test/x' } });
    await post({ locale: 'en', name: 'view_item', page: { path: 'https://evil.test/x' } });
    expect(vi.mocked(trackServerEvent).mock.calls.map(([, event]) => event.page)).toEqual([null, null]);
  });

  it('refuses unknown events, locales and bodies without calling the backend', async () => {
    expect((await post({ locale: 'en', name: 'refund' })).status).toBe(400);
    expect((await post({ locale: 'fr', name: 'login' })).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
    expect((await post({ locale: 'en', name: 'search', searchTerm: 'x'.repeat(9000) })).status).toBe(413);
    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});
