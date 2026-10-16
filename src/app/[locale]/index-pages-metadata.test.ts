import { describe, expect, it, vi } from 'vitest';
import { generateMetadata as allCategories } from './all-categories/page';
import { generateMetadata as brands } from './brands/page';
import { generateMetadata as categories } from './categories/page';
import { generateMetadata as vendors } from './vendors/page';

vi.mock('@/lib/catalog.server', () => ({ loadCategoryTree: vi.fn(), loadBrandsPage: vi.fn(), loadVendorsPage: vi.fn() }));

const params = (locale: string) => ({ params: Promise.resolve({ locale }) });
const search = (query: Record<string, string> = {}) => ({ searchParams: Promise.resolve(query) });
const languages = (path: string) => ({ en: `/en/${path}`, ar: `/ar/${path}`, 'x-default': `/ar/${path}` });

/**
 * The indexes without a backend Seo used to inherit the layout's alternates (the home page) and had
 * no canonical (crawl 2026-10-12): each sets its own now.
 */
describe('canonical + hreflang + x-default of the index pages', () => {
  it.each(['en', 'ar'])('/brands and /all-categories (%s): self canonical, both languages, x-default Arabic', async (locale) => {
    expect((await brands({ ...params(locale), ...search() })).alternates).toEqual({ canonical: `/${locale}/brands`, languages: languages('brands') });
    expect((await allCategories(params(locale))).alternates).toEqual({ canonical: `/${locale}/all-categories`, languages: languages('all-categories') });
    expect((await categories(params(locale))).alternates).toEqual({ canonical: `/${locale}/categories`, languages: languages('categories') });
    expect((await vendors(params(locale))).alternates).toEqual({ canonical: `/${locale}/vendors`, languages: languages('vendors') });
  });

  it('a later page of /brands is its own canonical; other query parameters are dropped', async () => {
    expect((await brands({ ...params('ar'), ...search({ page: '3', utm_source: 'x' }) })).alternates).toEqual({ canonical: '/ar/brands?page=3', languages: languages('brands?page=3') });
    expect((await brands({ ...params('en'), ...search({ sort: 'name' }) })).alternates).toMatchObject({ canonical: '/en/brands' });
  });

  it('titles stay translated; an unknown locale gets nothing', async () => {
    expect((await allCategories(params('ar'))).title).toBeTruthy();
    expect(await allCategories(params('fr'))).toEqual({});
    expect(await brands({ ...params('fr'), ...search() })).toEqual({});
  });
});
