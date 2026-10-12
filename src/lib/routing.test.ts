import { describe, expect, it } from 'vitest';
import type { Locale, Target } from '@/sdk';
import { addressReturn, addressReturnHref, externalHref, interimRedirect, isPrivatePath, isStorefrontPath, loyaltyStepHref, resolveTarget, retiredAccountPage, routes, safeReturnPath, signInReturn, switchLocalePath } from './routing';

/** The old storefront's URLs (url-parity-plan §1 in the backend repo): every link builds one of them. */
describe('resolveTarget', () => {
  const cases: Array<[Target, string]> = [
    [{ type: 'product', slug: 'jj-bath' }, '/en/jj-bath'],
    [{ type: 'category', path: ['skin-care', 'face-care'] }, '/en/product/skin-care/face-care'],
    [{ type: 'brand', slug: 'bioderma' }, '/en/product/brand/bioderma'],
    [{ type: 'brand', slug: 'bioderma--vichy' }, '/en/product/brand/bioderma--vichy'],
    [{ type: 'list', slug: 'summer', id: 3 }, '/en/products/list/summer'],
    [{ type: 'list', slug: null, id: 125 }, '/en/products/list/125'],
    [{ type: 'page', slug: 'about-us' }, '/en/pages/about-us'],
    [{ type: 'page', slug: 'privacy', legal: 'privacy' }, '/en/privacy-policy'],
    [{ type: 'page', slug: 'terms', legal: 'terms' }, '/en/terms-and-conditions'],
    [{ type: 'page', slug: 'cookies', legal: 'cookies' }, '/en/cookie-policy'],
    [{ type: 'landing_page', slug: 'ramadan' }, '/en/landing-page/ramadan'],
    [{ type: 'form', slug: 'prescriptions' }, '/en/forms/prescriptions'],
    [{ type: 'tag', slug: 'new-in' }, '/en/products/tag/new-in'],
    [{ type: 'search', query: 'panadol extra' }, '/en/products?search=panadol%20extra'],
    [{ type: 'search', query: '' }, '/en/all-products'],
    [{ type: 'deals' }, '/en/products/deals'],
    [{ type: 'home' }, '/en'],
  ];

  it.each(cases)('maps %j', (target, href) => {
    expect(resolveTarget(target, 'en')).toEqual({ href, external: false });
  });

  it('prefixes the locale', () => {
    expect(resolveTarget({ type: 'product', slug: 'x' }, 'ar')?.href).toBe('/ar/x');
  });

  it('writes Arabic category and brand slugs as the API sends them, encoded', () => {
    expect(resolveTarget({ type: 'category', path: ['الادوية', 'مضادات'] }, 'ar')?.href).toBe(`/ar/product/${encodeURIComponent('الادوية')}/${encodeURIComponent('مضادات')}`);
    expect(resolveTarget({ type: 'brand', slug: 'بيوديرما--vichy' }, 'ar')?.href).toBe(`/ar/product/brand/${encodeURIComponent('بيوديرما')}--vichy`);
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
    const href = route('en', (name === 'category' || name === 'categoryView' ? ['x'] : 'x') as never);
    expect(isStorefrontPath(href), href).toBe(true);
  });

  it('knows the old storefront pages it renders', () => {
    for (const path of [
      '/en', '/en/', '/ar/some-product', '/en/product', '/en/product/skin-care/face-care?sort=y', '/en/product/skin-care/brand/bioderma',
      '/en/product/deals/skin-care', '/en/products', '/en/products?search=x', '/en/products/deals', '/en/products/deals/summer',
      '/en/products/list/125', '/en/products/list/baby/skin-care', '/en/products/tag/new', '/en/landing-page/x', '/en/brand-page/x',
      '/en/pages/about-us', '/en/forms/x', '/en/privacy-policy', '/en/terms-and-conditions', '/en/cookie-policy', '/en/all-categories',
      '/en/brands', '/en/vendors/3', '/en/category', '/en/category/skin-care', '/en/category/skin-care/face-care', '/en/category-view',
      '/en/session/signin', '/en/orders/order-history/abc', '/en/account/anything/deep',
    ]) {
      expect(isStorefrontPath(path), path).toBe(true);
    }
  });

  it('leaves the old pages it does not render to the backend resolver', () => {
    for (const path of [
      '/en/products/some-product', '/en/products/name/1471', '/en/products/deals/name/1471', '/en/brands/bioderma', '/en/brand/758',
      '/en/category/skin-care/face-care/x', '/en/category-view/x', '/en/blog', '/en/skin-care/face-care', '/en/a/b/c/d/e/f', '/en/p/x', '/en/c/x', '/en/deals',
      '/fr/x', '/x',
    ]) {
      expect(isStorefrontPath(path), path).toBe(false);
    }
  });

  it('tells the shopper-private pages (no SEO, no merchant redirects)', () => {
    expect(isPrivatePath('/en/session/signin')).toBe(true);
    expect(isPrivatePath('/ar/orders/order-history/x')).toBe(true);
    expect(isPrivatePath('/en/checkout/final-receipt')).toBe(true);
    expect(isPrivatePath('/en/sessions')).toBe(false);
    expect(isPrivatePath('/en/product/x')).toBe(false);
  });
});

describe('interim URLs (before the old URLs were taken over)', () => {
  it.each([
    ['/en/p/jj-bath', '', '/en/jj-bath'],
    ['/ar/c/skin-care/face-care', '?page=2', '/ar/product/skin-care/face-care?page=2'],
    ['/en/lists/125', '', '/en/products/list/125'],
    ['/en/tags/new', '', '/en/products/tag/new'],
    ['/en/l/ramadan', '', '/en/landing-page/ramadan'],
    ['/en/deals', '?sort=x', '/en/products/deals?sort=x'],
    ['/en/search', '?q=panadol&brands=a', '/en/products?brands=a&search=panadol'],
    ['/en/wishlist', '', '/en/favorites'],
    ['/en/sign-in', '?next=%2Fen%2Fcart', '/en/session/signin?returnUrl=%2Fen%2Fcart'],
    ['/en/reset-password', '?token=t&email=e', '/en/session/change-password?token=t&email=e'],
    ['/en/verify-email', '?token=t', '/en/session/verifyEmail?token=t'],
    ['/en/checkout/result', '?checkout=r', '/en/checkout/final-receipt?checkout=r'],
    ['/en/account/orders/abc', '', '/en/account/order-history/abc'],
    ['/en/account/addresses/501/edit', '?next=checkout', '/en/account/address/edit/501?next=checkout'],
    ['/en/account/password', '', '/en/account/change-password'],
    ['/en/track-order', '?number=1', '/en/account/track-your-order?number=1'],
  ])('%s%s → %s', (path, search, to) => {
    expect(interimRedirect(path, search)).toBe(to);
  });

  it('leaves the old URLs alone', () => {
    for (const path of ['/en/jj-bath', '/en/product/x', '/en/products', '/en/account/order-history', '/en/session/signin', '/x']) {
      expect(interimRedirect(path, ''), path).toBeNull();
    }
  });

  it('sends the old account pages that are not built to the account home', () => {
    expect(retiredAccountPage('/ar/account/cards')).toBe('/ar/account');
    expect(retiredAccountPage('/en/orders/link-builder')).toBe('/en/account');
    expect(retiredAccountPage('/en/account/profile')).toBeNull();
  });
});

describe('the old category view', () => {
  it('keeps the /category address (Arabic slugs encoded), and /category-view', () => {
    expect(routes.categoryView('en')).toBe('/en/category');
    expect(routes.categoryView('en', ['skin-care', 'face-care'])).toBe('/en/category/skin-care/face-care');
    expect(routes.categoryView('ar', ['عناية'])).toBe(`/ar/category/${encodeURIComponent('عناية')}`);
    expect(routes.categoryViewIndex('ar')).toBe('/ar/category-view');
  });
});

describe('account routes', () => {
  it('builds the address book links with their return page and the saved address', () => {
    expect(routes.addresses('en')).toBe('/en/account/address');
    expect(routes.addresses('ar', { next: 'checkout', saved: 602 })).toBe('/ar/account/address?next=checkout&saved=602');
    expect(routes.newAddress('en', 'checkout')).toBe('/en/account/address/add?next=checkout');
    expect(routes.editAddress('en', 501)).toBe('/en/account/address/edit/501');
    expect(routes.order('en', 'mock-order-48201')).toBe('/en/account/order-history/mock-order-48201');
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

  it('keeps the old storefront paths of loyalty', () => {
    expect(routes.points('en')).toBe('/en/account/your-points');
    expect(routes.wallet('ar')).toBe('/ar/account/wallet-history');
    expect(routes.wallet('en', 2)).toBe('/en/account/wallet-history?page=2');
    expect(routes.myVouchers('ar')).toBe('/ar/account/voucher');
    // phase B: vendors
    expect(routes.vendors('en')).toBe('/en/vendors');
    expect(resolveTarget({ type: 'vendor', id: 3 }, 'ar')).toEqual({ href: '/ar/vendors/3', external: false });
    expect(isStorefrontPath('/en/vendors/3')).toBe(true);
    expect(routes.rewards('ar')).toBe('/ar/account/vouchers');
    expect(routes.reward('en', '4')).toBe('/en/account/vouchers/4');
    expect(routes.pointsHistory('en')).toBe('/en/account/history');
    expect(routes.pointsHistory('ar', 3)).toBe('/ar/account/history?page=3');
    expect(routes.freePoints('ar')).toBe('/ar/account/get-free-points');
    expect(isStorefrontPath('/en/account/vouchers/4/free-delivery')).toBe(true);
  });

  it('a loyalty blocker links the page that clears it', () => {
    expect(loyaltyStepHref('en', 'verify_phone')).toBe('/en/verify-phone');
    expect(loyaltyStepHref('ar', 'add_phone')).toBe('/ar/account/profile');
    expect(loyaltyStepHref('en', 'add_address')).toBeNull();
    expect(loyaltyStepHref('en', 'something_new')).toBeNull();
  });

  it('signs in and comes back to a local page only', () => {
    expect(routes.signIn('en')).toBe('/en/session/signin');
    expect(routes.signIn('en', '/en/account/orders')).toBe('/en/session/signin?returnUrl=%2Fen%2Faccount%2Forders');
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
    expect(switchLocalePath('/en/jj-bath', 'ar')).toBe('/ar/jj-bath');
    expect(switchLocalePath('/ar', 'en')).toBe('/en');
  });
});
