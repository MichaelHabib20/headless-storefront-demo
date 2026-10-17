import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner } from '@/sdk';

const calls = vi.hoisted(() => ({ form: [] as string[], listing: [] as unknown[] }));
vi.mock('./content.server', () => ({
  loadForm: async (locale: string, slug: string) => {
    calls.form.push(`${locale}:${slug}`);
    return slug === 'prescriptions' ? { status: 'ok', data: { title: locale === 'ar' ? 'الوصفات الطبية' : 'Prescriptions' } } : { status: 'not-found' };
  },
  loadPage: async () => ({ status: 'ok', data: { title: 'About us' } }),
  loadLandingPage: async () => ({ status: 'ok', data: { title: null, seo: { title: 'Summer sale' } } }),
}));
vi.mock('./catalog.server', () => ({
  loadListing: async (_locale: string, scope: unknown) => {
    calls.listing.push(scope);
    return { status: 'ok', listing: { context: { title: 'Divol' } } };
  },
}));
vi.mock('./shopper.server', () => ({ shopperContext: async (locale: string) => ({ locale, token: null }) }));
vi.mock('./storefront.server', () => ({ storefrontClient: () => ({}) }));
vi.mock('@/sdk', async (original) => ({
  ...(await original<typeof import('@/sdk')>()),
  getProduct: async () => {
    throw new Error('API down');
  },
}));

import { targetTitle, withBannerNames } from './banner-names.server';

const banner = (patch: Partial<Banner>): Banner => ({
  id: 1,
  image: { mobile: 'm.jpg', desktop: 'd.jpg', alt: null },
  title: null,
  target: { type: 'form', slug: 'prescriptions' },
  ...patch,
});

describe('banner names', () => {
  beforeEach(() => {
    calls.form = [];
    calls.listing = [];
  });

  it('an unnamed banner is named after the page it opens, in the page language (round 5, N3)', async () => {
    const [en] = await withBannerNames([banner({})], 'en');
    const [ar] = await withBannerNames([banner({})], 'ar');
    expect(en.image.alt).toBe('Prescriptions');
    expect(ar.image.alt).toBe('الوصفات الطبية');
  });

  it('keeps the merchant alt text and the API name, without asking for the page', async () => {
    const named = [banner({ image: { mobile: 'm', desktop: 'd', alt: 'Send your prescription' } }), banner({ title: 'Top AD' })];
    expect(await withBannerNames(named, 'en')).toEqual(named);
    expect(calls.form).toEqual([]);
  });

  it('reads the title of every page type it can, and null when there is none', async () => {
    expect(await targetTitle({ type: 'page', slug: 'about' }, 'en')).toBe('About us');
    expect(await targetTitle({ type: 'landing_page', slug: 'summer' }, 'en')).toBe('Summer sale');
    expect(await targetTitle({ type: 'list', slug: null, id: 176 }, 'en')).toBe('Divol');
    expect(calls.listing).toEqual([{ list: 176 }]);
    expect(await targetTitle({ type: 'form', slug: 'gone' }, 'en')).toBeNull();
    expect(await targetTitle({ type: 'product', slug: 'x' }, 'en')).toBeNull(); // the API failing never breaks the home page
    expect(await targetTitle({ type: 'url', url: 'https://example.com' }, 'en')).toBeNull();
    expect(await targetTitle(null, 'en')).toBeNull();
  });

  it('leaves a banner without a page title as it is (the component says "Banner")', async () => {
    const lone = banner({ target: null });
    expect(await withBannerNames([lone], 'ar')).toEqual([lone]);
  });
});
