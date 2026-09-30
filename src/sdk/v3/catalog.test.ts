import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import { getBrands, getCategories, getProducts, getSearchSuggestions, listingQuery, resolvePath } from './catalog';
import { createStorefrontClient } from './http';

const ROOT = 'https://api.test/api/customer/v3/';

function setup(status = 200, body: unknown = { data: { ok: true } }) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch, revalidate: 60 });
  const last = () => {
    const [url, init] = fetch.mock.calls.at(-1)!;
    return { url: String(url), headers: init!.headers as Record<string, string>, init: init! };
  };
  return { client, last };
}

describe('listingQuery', () => {
  it('sends the category path joined with "/" next to the page parameters, untouched', () => {
    expect(listingQuery({ category: ['skin-care', 'face-care'] }, { brands: 'a,b', sort: 'price_asc', page: '2' })).toBe('brands=a%2Cb&sort=price_asc&page=2&category=skin-care%2Fface-care');
  });

  it('keeps repeated parameters and their order', () => {
    expect(listingQuery({ brand: 'bioderma' }, new URLSearchParams('options=1&options=2&x=y'))).toBe('options=1&options=2&x=y&brand=bioderma');
    expect(listingQuery({}, { options: ['1', '2'] })).toBe('options=1&options=2');
  });

  it('takes the scope from the route only (one scope, never locale from the URL)', () => {
    expect(listingQuery({ tag: 'new' }, { brand: 'x', category: 'y', locale: 'ar', q: 'z' })).toBe('tag=new');
    expect(listingQuery({ list: 125 }, {})).toBe('list=125');
    expect(listingQuery({ deals: true }, { deals: 'false' })).toBe('deals=true');
  });

  it('searches for q, and lists everything without it', () => {
    expect(listingQuery({ q: 'panadol extra' }, { q: 'panadol extra', inStock: 'true' })).toBe('inStock=true&q=panadol+extra');
    expect(listingQuery({ q: '' }, { q: '' })).toBe('');
    expect(listingQuery({})).toBe('');
  });
});

describe('catalog SDK', () => {
  it('getProducts reads the listing with the shopper token and the query as one string', async () => {
    const { client, last } = setup(200, { data: { items: [] } });
    await getProducts(client, { locale: 'ar', token: 'cust' }, { category: ['mom-baby'] }, { options: ['a', 'b'] });
    const { url, headers, init } = last();
    expect(url).toBe(`${ROOT}products?options=a&options=b&category=mom-baby`);
    expect(headers).toMatchObject({ Authorization: 'Bearer cust', 'Accept-Language': 'ar' });
    expect(init.method).toBe('GET');
  });

  it('getProducts without anything lists all products', async () => {
    const { client, last } = setup(200, { data: { items: [] } });
    await getProducts(client, { locale: 'en', token: null }, {});
    expect(last().url).toBe(`${ROOT}products`);
    expect(last().headers).not.toHaveProperty('Authorization');
  });

  it('an unknown scope is not_found, refused filters are validation', async () => {
    await expect(getProducts(setup(404, { error: { code: 'not_found', message: 'Nope' } }).client, { locale: 'en', token: null }, { brand: 'x' })).rejects.toMatchObject({ kind: 'not_found', message: 'Nope' });
    const invalid = getProducts(setup(422, { error: { code: 'validation_failed', message: 'Bad', fields: { priceMin: ['Must be a number'] } } }).client, { locale: 'en', token: null }, {}, { priceMin: 'x' });
    await expect(invalid).rejects.toBeInstanceOf(ApiError);
    await expect(invalid).rejects.toMatchObject({ kind: 'validation', fieldErrors: { priceMin: ['Must be a number'] } });
  });

  it('getSearchSuggestions sends q (and a limit when given)', async () => {
    const { client, last } = setup(200, { data: { query: 'bath', products: [] } });
    await getSearchSuggestions(client, { locale: 'en', token: null }, 'baby bath');
    expect(last().url).toBe(`${ROOT}search/suggestions?q=baby+bath`);
    await getSearchSuggestions(client, { locale: 'en', token: 'g' }, 'x', 3);
    expect(last().url).toBe(`${ROOT}search/suggestions?q=x&limit=3`);
    expect(last().headers.Authorization).toBe('Bearer g');
  });

  it('getCategories and getBrands are public reads', async () => {
    const { client, last } = setup(200, { data: { items: [] } });
    await getCategories(client, 'ar');
    expect(last().url).toBe(`${ROOT}categories`);
    expect(last().headers).not.toHaveProperty('Authorization');
    await getBrands(client, 'en', { page: 2, perPage: 24 });
    expect(last().url).toBe(`${ROOT}brands?page=2&perPage=24`);
    await getBrands(client, 'en');
    expect(last().url).toBe(`${ROOT}brands`);
  });

  it('resolvePath sends the requested path and query', async () => {
    const { client, last } = setup(200, { data: { result: 'not_found', target: null, url: null, permanent: false } });
    const answer = await resolvePath(client, 'en', '/en/product/12?utm=x');
    expect(answer.result).toBe('not_found');
    expect(last().url).toBe(`${ROOT}resolve?path=%2Fen%2Fproduct%2F12%3Futm%3Dx`);
  });
});
