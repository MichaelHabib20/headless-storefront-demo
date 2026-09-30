import fs from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator, toJsonSchema } from './lib/contract.mjs';
import { createModules } from './mock/modules.mjs';
import { createProductModule } from './mock/product.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const contract = YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8'));
const validate = createValidator(contract);
const notifyMeOk = new Ajv({ strict: false }).compile(
  toJsonSchema(contract.paths['/products/{productId}/notify-me'].post.responses['200'].content['application/json'].schema),
);

function setup(locale = 'en') {
  const store = createShopperStore();
  const products = createProductModule(store);
  const call = (method, pathname, { token = null, body = null, query = '' } = {}) => {
    const answer = products.handle({ method, pathname, query: new URLSearchParams(query), token, locale, body });
    return answer ? { status: answer[0], payload: answer[1] } : null;
  };
  const slug = (id, inLocale = locale) => store.product(id, inLocale).slug;
  const guest = () => store.handle({ method: 'POST', pathname: '/session/guest', query: new URLSearchParams(), token: null, locale, body: null })[1].data.token;
  return { store, products, call, slug, guest };
}

function expectValid(schema, payload) {
  expect(validate(schema, payload)).toEqual([]);
}

const PRODUCT_IDS = JSON.parse(fs.readFileSync('src/test/fixtures/v3/home.en.json', 'utf8')).data.sections.flatMap((s) => s.products.map((p) => p.id));

describe('mock product module follows the contract', () => {
  it.each(['en', 'ar'])('every product page, recommendation row and review page (%s)', (locale) => {
    const { call, slug } = setup(locale);
    for (const id of PRODUCT_IDS) {
      const product = call('GET', `/products/${encodeURIComponent(slug(id))}`);
      expect(product.status).toBe(200);
      expectValid('ProductDetailsResponse', product.payload);
      expect(product.payload.data.product.id).toBe(id);
      expect(product.payload.data.redirect).toBeNull();

      expectValid('ProductRecommendationsResponse', call('GET', `/products/${encodeURIComponent(slug(id))}/recommendations`).payload);
      expectValid('ProductReviewsResponse', call('GET', `/products/${encodeURIComponent(slug(id))}/reviews`, { query: 'page=2&perPage=5' }).payload);
    }
  });

  it.each(['en', 'ar'])('errors and notify-me answers (%s)', (locale) => {
    const { call, guest } = setup(locale);

    const missing = call('GET', '/products/definitely-not-a-product');
    expect(missing.status).toBe(404);
    expectValid('ErrorResponse', missing.payload);
    expect(missing.payload.error.code).toBe('not_found');

    const anonymous = call('POST', '/products/14400/notify-me', { body: {} });
    expect(anonymous.status).toBe(401);
    expectValid('ErrorResponse', anonymous.payload);

    const token = guest();
    const needsEmail = call('POST', '/products/14400/notify-me', { token, body: {} });
    expect(needsEmail.status).toBe(422);
    expectValid('ErrorResponse', needsEmail.payload);
    expect(needsEmail.payload.error.fields.email).toHaveLength(1);

    const badEmail = call('POST', '/products/14400/notify-me', { token, body: { email: 'not-an-email' } });
    expect(badEmail.status).toBe(422);
    expectValid('ErrorResponse', badEmail.payload);

    const subscribed = call('POST', '/products/14400/notify-me', { token, body: { email: 'sara@example.com' } });
    expect(subscribed.status).toBe(200);
    expect(notifyMeOk(subscribed.payload)).toBe(true);

    const inStock = call('POST', '/products/8412/notify-me', { token, body: {} });
    expect(inStock.status).toBe(409);
    expectValid('ErrorResponse', inStock.payload);
    expect(inStock.payload.error.code).toBe('already_available');

    const unknown = call('POST', '/products/999999/notify-me', { token, body: {} });
    expect(unknown.status).toBe(404);
    expectValid('ErrorResponse', unknown.payload);
  });
});

describe('mock product states', () => {
  it('options: every value is drawn from the backend state, and links to another product', () => {
    const { call, slug } = setup('en');
    const [size, scent] = call('GET', `/products/${slug(9822)}`).payload.data.options;

    expect(size.display).toBe('buttons');
    expect(size.values.map((v) => [v.label, v.state, v.target?.slug ?? null])).toEqual([
      ['100 ml', 'selected', null],
      ['200 ml', 'available', slug(36510)],
    ]);
    expect(scent.display).toBe('color');
    expect(scent.values.map((v) => [v.label, v.state, v.target?.slug ?? null])).toEqual([
      ['Dream', 'selected', null],
      ['Morning Dew', 'out_of_stock', slug(14400)],
      ['Lemon Fresh', 'available', slug(14482)],
    ]);

    // 200 ml exists only in Dream
    const big = call('GET', `/products/${slug(36510)}`).payload.data.options[1].values;
    expect(big.map((v) => v.state)).toEqual(['selected', 'unavailable', 'unavailable']);
    expect(big[1].target).toBeNull();
  });

  it('out of stock with notify-me, coming soon, discounted, low stock', () => {
    const { call, slug } = setup('en');
    const outOfStock = call('GET', `/products/${slug(14400)}`).payload.data;
    expect(outOfStock.availability).toEqual({ status: 'out_of_stock', message: 'Out of stock', notifyMe: true });
    expect(outOfStock.product.purchase.canAddToCart).toBe(false);

    const comingSoon = call('GET', `/products/${slug(15472)}`).payload.data;
    expect(comingSoon.availability).toMatchObject({ status: 'coming_soon', notifyMe: false });
    expect(comingSoon.sku).toBeNull();
    expect(comingSoon.product.badges).toEqual([{ kind: 'coming_soon', text: null, color: null }]);

    const discounted = call('GET', `/products/${slug(8658)}`).payload.data.product.price;
    expect(discounted).toMatchObject({ display: '180 EGP', compareAtDisplay: '200 EGP', discountLabel: '10 %' });

    expect(call('GET', `/products/${slug(8412)}`).payload.data.availability.message).toBe('Only 3 left');
  });

  it('a restocked product is available again and notify-me answers already_available', () => {
    const { call, guest, slug } = setup('en');
    expect(call('POST', '/__mock/products/14400/restock').status).toBe(200);
    expect(call('GET', `/products/${slug(14400)}`).payload.data.availability.status).toBe('available');
    expect(call('POST', '/products/14400/notify-me', { token: guest(), body: {} }).status).toBe(409);
  });

  it('the signed-in customer subscribes without an email; reset forgets it', () => {
    const { call, products } = setup('ar');
    expect(call('POST', '/products/14400/notify-me', { token: 'test-customer', body: {} }).status).toBe(200);
    expect(products.subscribed('test-customer', 14400)).toBe(true);
    products.reset();
    expect(products.subscribed('test-customer', 14400)).toBe(false);
  });

  it('gallery with a video, and a product with one image', () => {
    const { call, slug } = setup('en');
    const bath = call('GET', `/products/${slug(36480)}`).payload.data;
    expect(bath.gallery).toHaveLength(4);
    expect(bath.video).toMatchObject({ url: expect.stringMatching(/^https:\/\//) });
    expect(bath.options[0].display).toBe('dropdown');
    expect(call('GET', `/products/${slug(9822)}`).payload.data.gallery).toHaveLength(1);
  });

  it('an English slug asked in Arabic answers with a redirect to the Arabic address', () => {
    const { call, slug } = setup('ar');
    const answer = call('GET', `/products/${encodeURIComponent(slug(7346, 'en'))}`).payload.data;
    expect(slug(7346, 'en')).not.toBe(slug(7346, 'ar'));
    expect(answer.redirect).toEqual({ type: 'product', slug: slug(7346, 'ar') });
    expect(answer.seo.canonical).toEqual({ type: 'product', slug: slug(7346, 'ar') });
  });

  it('reviews: several pages, a summary, and a product with reviews switched off', () => {
    const { call, slug } = setup('en');
    const first = call('GET', `/products/${slug(9822)}/reviews`, { query: 'perPage=5' }).payload.data;
    expect(first.pagination).toEqual({ page: 1, perPage: 5, total: 23, totalPages: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.summary.count).toBe(23);
    expect(first.summary.distribution.map((d) => d.stars)).toEqual([5, 4, 3, 2, 1]);
    const last = call('GET', `/products/${slug(9822)}/reviews`, { query: 'perPage=5&page=5' }).payload.data;
    expect(last.items).toHaveLength(3);

    expect(call('GET', `/products/${slug(33594)}/reviews`).payload.data.enabled).toBe(false);
  });

  it('recommendations: related and bought together with a total', () => {
    const { call, slug } = setup('en');
    const { sections } = call('GET', `/products/${slug(9822)}/recommendations`).payload.data;
    expect(sections.map((s) => s.key)).toEqual(['related', 'frequently_bought_together']);
    expect(sections[0].total).toBeNull();
    expect(sections[1].total).toMatchObject({ display: '258.00 EGP' });
  });

  it('is part of the mock API, and leaves other paths to the next module', () => {
    const { call } = setup('en');
    expect(call('GET', '/products')).toBeNull();
    expect(call('GET', '/cart')).toBeNull();
    const request = { method: 'GET', pathname: '/products/jj-baby-bath-500ml', query: new URLSearchParams(), token: null, locale: 'en', body: null };
    expect(createModules(createShopperStore()).some((part) => part.handle(request))).toBe(true);
  });
});
