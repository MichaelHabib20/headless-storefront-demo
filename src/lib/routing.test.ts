import { describe, expect, it } from 'vitest';
import type { Locale, Target } from '@/sdk';
import { addressReturn, addressReturnHref, externalHref, isStorefrontPath, resolveTarget, routes, safeReturnPath, signInReturn, switchLocalePath } from './routing';

describe('resolveTarget', () => {
  const cases: Array<[Target, string]> = [
    [{ type: 'product', slug: 'jj-bath' }, '/en/p/jj-bath'],
    [{ type: 'category', path: ['skin-care', 'face-care'] }, '/en/c/skin-care/face-care'],
    [{ type: 'brand', slug: 'bioderma' }, '/en/brands/bioderma'],
    [{ type: 'list', slug: 'summer', id: 3 }, '/en/lists/summer'],
    [{ type: 'list', slug: null, id: 125 }, '/en/lists/125'],
    [{ type: 'page', slug: 'about-us' }, '/en/pages/about-us'],
    [{ type: 'landing_page', slug: 'ramadan' }, '/en/l/ramadan'],
    [{ type: 'form', slug: 'prescriptions' }, '/en/forms/prescriptions'],
    [{ type: 'tag', slug: 'new-in' }, '/en/tags/new-in'],
    [{ type: 'search', query: 'panadol extra' }, '/en/search?q=panadol%20extra'],
    [{ type: 'search', query: '' }, '/en/all-products'],
    [{ type: 'deals' }, '/en/deals'],
    [{ type: 'home' }, '/en'],
  ];

  it.each(cases)('maps %j', (target, href) => {
    expect(resolveTarget(target, 'en')).toEqual({ href, external: false });
  });

  it('prefixes the locale', () => {
    expect(resolveTarget({ type: 'product', slug: 'x' }, 'ar')?.href).toBe('/ar/p/x');
  });

  it('encodes Arabic slugs', () => {
    expect(resolveTarget({ type: 'page', slug: 'عنا' }, 'ar')?.href).toBe('/ar/pages/%D8%B9%D9%86%D8%A7');
  });

  it('keeps external links external', () => {
    expect(resolveTarget({ type: 'url', url: 'https://cdn.example.com/a.pdf' }, 'en')).toEqual({ href: 'https://cdn.example.com/a.pdf', external: true });
  });

  it('refuses unsafe urls', () => {
    expect(resolveTarget({ type: 'url', url: 'javascript:alert(1)' }, 'en')).toBeNull();
  });

  it('skips null and unknown targets instead of guessing', () => {
    expect(resolveTarget(null, 'en')).toBeNull();
    expect(resolveTarget({ type: 'gift_card', slug: 'x' } as unknown as Target, 'en')).toBeNull();
    expect(resolveTarget({ type: 'list', slug: null, id: null }, 'en')).toBeNull();
  });
});

describe('isStorefrontPath', () => {
  it.each(Object.keys(routes))('knows the route %s as one of ours', (name) => {
    const route = routes[name as keyof typeof routes] as (locale: Locale, arg: never) => string;
    const href = route('en', (name === 'category' ? ['x'] : 'x') as never);
    expect(isStorefrontPath(href), href).toBe(true);
  });

  it('leaves everything else to the backend resolver', () => {
    expect(isStorefrontPath('/en/product/skin-care/face-care')).toBe(false);
    expect(isStorefrontPath('/ar/old-page?x=1')).toBe(false);
    expect(isStorefrontPath('/en')).toBe(true);
    expect(isStorefrontPath('/en/c/x?sort=y')).toBe(true);
  });
});

describe('account routes', () => {
  it('builds the address book links with their return page and the saved address', () => {
    expect(routes.addresses('en')).toBe('/en/account/addresses');
    expect(routes.addresses('ar', { next: 'checkout', saved: 602 })).toBe('/ar/account/addresses?next=checkout&saved=602');
    expect(routes.newAddress('en', 'checkout')).toBe('/en/account/addresses/new?next=checkout');
    expect(routes.editAddress('en', 501)).toBe('/en/account/addresses/501/edit');
    expect(routes.order('en', 'mock-order-48201')).toBe('/en/account/orders/mock-order-48201');
  });

  it('accepts only the known return page (no open redirect)', () => {
    expect(addressReturn('checkout')).toBe('checkout');
    expect(addressReturn(['checkout', 'x'])).toBe('checkout');
    for (const value of ['https://evil.test', '//evil.test', '/en/checkout', 'CHECKOUT', '', undefined, null]) {
      expect(addressReturn(value)).toBeNull();
    }
    expect(addressReturnHref('ar', 'checkout')).toBe('/ar/checkout');
    expect(addressReturnHref('en', null)).toBeNull();
    // the required address step of a prescription goes back to the prescriptions page
    expect(addressReturn('prescriptions')).toBe('prescriptions');
    expect(addressReturnHref('ar', 'prescriptions')).toBe('/ar/prescriptions');
  });

  it('keeps the old storefront paths of the account extras', () => {
    expect(routes.prescriptions('en')).toBe('/en/prescriptions');
    expect(routes.prescriptions('ar', 2)).toBe('/ar/prescriptions?page=2');
    expect(routes.addAddress('ar')).toBe('/ar/add-address');
    expect(routes.allProducts('en')).toBe('/en/all-products');
  });

  it('signs in and comes back to a local page only', () => {
    expect(routes.signIn('en')).toBe('/en/sign-in');
    expect(routes.signIn('en', '/en/account/orders')).toBe('/en/sign-in?next=%2Fen%2Faccount%2Forders');
    expect(safeReturnPath('/en/account/orders')).toBe('/en/account/orders');
    expect(safeReturnPath('/ar/account/orders/mock-order-1?x=1')).toBe('/ar/account/orders/mock-order-1?x=1');
    for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/en//evil.test', '/fr/x', 'en/x', '/english', ' /en', '/constructor', undefined]) {
      expect(safeReturnPath(value), String(value)).toBeNull();
    }
  });

  it('sends sign-in back to checkout or a local page only', () => {
    expect(signInReturn('ar', 'checkout')).toBe('/ar/checkout');
    expect(signInReturn('en', '/en/account/orders')).toBe('/en/account/orders');
    expect(signInReturn('en', 'https://evil.test')).toBeNull();
    expect(signInReturn('en', undefined)).toBeNull();
  });

  it('keeps only web links from the API as external links', () => {
    expect(externalHref('https://maps.example.com/?q=x')).toBe('https://maps.example.com/?q=x');
    expect(externalHref('javascript:alert(1)')).toBeNull();
    expect(externalHref(null)).toBeNull();
  });
});

describe('switchLocalePath', () => {
  it('keeps the path and swaps the locale', () => {
    expect(switchLocalePath('/en/p/jj-bath', 'ar')).toBe('/ar/p/jj-bath');
    expect(switchLocalePath('/ar', 'en')).toBe('/en');
  });
});
