import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { searchSuggestionsAction } from './catalog.actions';
import { loadListing } from './catalog.server';
import { ensureShopperContext } from './shopper.server';

const env = vi.hoisted(() => ({ token: null as string | null, fetch: undefined as unknown as Mock<typeof fetch> }));

vi.mock('./shopper.server', () => ({
  shopperContext: vi.fn(async (locale: 'en' | 'ar') => ({ locale, token: env.token })),
  ensureShopperContext: vi.fn(),
}));

vi.mock('./storefront.server', async () => {
  const { createStorefrontClient } = await import('@/sdk');
  return { storefrontClient: () => createStorefrontClient({ baseUrl: 'https://api.test', fetch: (input, init) => env.fetch(input, init) }) };
});

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const calls = () => env.fetch.mock.calls.map(([url, init]) => ({ url: String(url).replace('https://api.test/api/customer/v3/', ''), auth: ((init as RequestInit).headers as Record<string, string>).Authorization }));
const suggestions = { query: 'bath', products: [], viewAll: { type: 'search', query: 'bath' } };

beforeEach(() => {
  vi.clearAllMocks();
  env.token = null;
  env.fetch = vi.fn(async () => reply(200, { data: suggestions }));
});

describe('searchSuggestionsAction', () => {
  it('reads suggestions with the shopper token, never creating a guest', async () => {
    env.token = 'guest-1';
    expect(await searchSuggestionsAction('ar', '  bath ')).toEqual({ ok: true, suggestions });
    expect(calls()).toEqual([{ url: 'search/suggestions?q=bath', auth: 'Bearer guest-1' }]);
    expect(ensureShopperContext).not.toHaveBeenCalled();
  });

  it('asks nothing for an empty text and cuts the text at the contract maximum', async () => {
    expect(await searchSuggestionsAction('en', '   ')).toEqual({ ok: false });
    expect(env.fetch).not.toHaveBeenCalled();
    await searchSuggestionsAction('en', 'a'.repeat(250));
    expect(calls()[0].url).toBe(`search/suggestions?q=${'a'.repeat(200)}`);
  });

  it('drops a token the backend no longer accepts, and reports failures without throwing', async () => {
    env.token = 'expired';
    env.fetch.mockResolvedValueOnce(reply(401, { error: { code: 'unauthenticated', message: 'No' } }));
    expect(await searchSuggestionsAction('en', 'bath')).toEqual({ ok: true, suggestions });
    expect(calls().map((c) => c.auth)).toEqual(['Bearer expired', undefined]);

    env.fetch.mockResolvedValue(reply(500, { error: { code: 'server_error', message: 'Down' } }));
    expect(await searchSuggestionsAction('en', 'bath')).toEqual({ ok: false });
  });
});

describe('loadListing', () => {
  it('sends the scope and the page parameters, and sorts API errors into page states', async () => {
    env.fetch.mockResolvedValueOnce(reply(200, { data: { items: [] } }));
    expect((await loadListing('en', { brand: 'x' }, { sort: 'price_asc', page: '2' })).status).toBe('ok');
    expect(calls()[0].url).toBe('products?sort=price_asc&page=2&brand=x');

    // the old storefront's names of the page's links go to the API in its own names
    env.fetch.mockResolvedValueOnce(reply(200, { data: { items: [] } }));
    await loadListing('en', { category: ['skin-care'] }, { brand_id: ['bioderma', 'vichy'], in_stock: '1', price_from: '10', sort: 'low', page: '2' });
    expect(calls()[1].url).toBe('products?brands=bioderma%2Cvichy&inStock=true&priceMin=10&sort=price_asc&page=2&category=skin-care');

    env.fetch.mockResolvedValueOnce(reply(404, { error: { code: 'not_found', message: 'No' } }));
    expect(await loadListing('en', { brand: 'nope' }, {})).toEqual({ status: 'not_found' });
    env.fetch.mockResolvedValueOnce(reply(422, { error: { code: 'validation_failed', message: 'Bad price' } }));
    expect(await loadListing('en', {}, { priceMin: 'abc' })).toEqual({ status: 'invalid', message: 'Bad price' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    env.fetch.mockResolvedValueOnce(reply(500, { error: { code: 'server_error', message: 'Down' } }));
    expect(await loadListing('en', { tag: 't' }, {})).toEqual({ status: 'error' });
  });

  it('retries without a token the backend no longer accepts', async () => {
    env.token = 'expired';
    env.fetch.mockResolvedValueOnce(reply(401, { error: { code: 'unauthenticated', message: 'No' } })).mockResolvedValueOnce(reply(200, { data: { items: [] } }));
    expect((await loadListing('en', { deals: true }, {})).status).toBe('ok');
    expect(calls().map((c) => c.auth)).toEqual(['Bearer expired', undefined]);
  });
});
