import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Seo } from '@/sdk';
import { productsFixture } from '@/test/fixtures';
import { productFixture } from '@/test/product-fixtures';
import { routes } from './routing';
import { contentPageSeo, ownPageAlternates, paginationHrefs, SeoLinks, seoMetadata, titleTemplate } from './seo';

const seo: Seo = {
  title: 'Controloc 40 mg',
  description: 'For heartburn.',
  canonical: { type: 'product', slug: 'controloc-40' },
  alternates: [
    { locale: 'en', target: { type: 'product', slug: 'controloc-40' } },
    { locale: 'ar', target: { type: 'product', slug: 'كونترولوك' } },
  ],
  index: true,
};

describe('seoMetadata', () => {
  it('turns the backend targets into the URLs of this storefront', () => {
    expect(seoMetadata(seo, 'en')).toEqual({
      title: { absolute: 'Controloc 40 mg' },
      description: 'For heartburn.',
      alternates: { canonical: '/en/controloc-40', languages: { en: '/en/controloc-40', ar: '/ar/%D9%83%D9%88%D9%86%D8%AA%D8%B1%D9%88%D9%84%D9%88%D9%83', 'x-default': '/ar/%D9%83%D9%88%D9%86%D8%AA%D8%B1%D9%88%D9%84%D9%88%D9%83' } },
      robots: undefined,
    });
  });

  it('tells search engines not to index when the backend says so', () => {
    const meta = seoMetadata({ ...seo, description: null, canonical: null, alternates: [], index: false }, 'ar');

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.description).toBeUndefined();
    expect(meta.alternates).toEqual({ canonical: undefined, languages: undefined });
  });

  it('the backend title is the whole title (no second "| store")', () => {
    expect(seoMetadata({ ...seo, title: 'Skin Care | Seif Pharmacies' }, 'en').title).toEqual({ absolute: 'Skin Care | Seif Pharmacies' });
  });

  it('writes the social preview, falling back to the title and description', () => {
    const meta = seoMetadata({ ...seo, openGraph: { title: null, description: null, image: 'https://cdn.test/a.webp', type: 'website' } }, 'ar');
    expect(meta.openGraph).toEqual({ title: 'Controloc 40 mg', description: 'For heartburn.', images: ['https://cdn.test/a.webp'], url: '/ar/controloc-40', locale: 'ar_EG', type: 'website' });
    expect(meta.twitter).toEqual({ card: 'summary_large_image', title: 'Controloc 40 mg', description: 'For heartburn.', images: ['https://cdn.test/a.webp'] });

    const product = seoMetadata(productFixture('en').seo, 'en');
    expect(product.openGraph).not.toHaveProperty('type');
    expect(seoMetadata({ ...seo, openGraph: { title: 'X', description: null, image: null, type: 'article' } }, 'en').twitter).toMatchObject({ card: 'summary', title: 'X' });
    expect(seoMetadata(seo, 'en').openGraph).toBeUndefined();
  });
});

describe('rel=prev/next and og:type=product', () => {
  it('pages of a listing, from the canonical page and the backend page numbers', () => {
    const listing = productsFixture('en').seo;
    expect(paginationHrefs({ ...listing, canonical: { type: 'category', path: ['skin-care'] }, pagination: { prev: 1, next: 3 } }, 'en')).toEqual({ prev: '/en/product/skin-care', next: '/en/product/skin-care?page=3' });
    expect(paginationHrefs({ ...listing, canonical: { type: 'search', query: 'baby oil' }, pagination: { prev: 4, next: null } }, 'ar')).toEqual({ prev: '/ar/products?search=baby+oil&page=4', next: null });
    expect(paginationHrefs({ ...listing, pagination: null }, 'en')).toEqual({ prev: null, next: null });
    expect(paginationHrefs({ ...listing, canonical: { type: 'url', url: 'https://x.test' }, pagination: { prev: 1, next: 2 } }, 'en')).toEqual({ prev: null, next: null });
  });

  it('renders the links and the product preview type', () => {
    const html = renderToStaticMarkup(SeoLinks({ seo: { ...seo, canonical: { type: 'brand', slug: 'bioderma' }, pagination: { prev: null, next: 2 }, openGraph: { title: null, description: null, image: null, type: 'product' } }, locale: 'en' }));
    expect(html).toBe('<link rel="next" href="/en/product/brand/bioderma?page=2"/><meta property="og:type" content="product"/>');
    const absolute = renderToStaticMarkup(SeoLinks({ seo: { ...seo, canonical: { type: 'category', path: ['skin-care'] }, pagination: { prev: 1, next: 3 } }, locale: 'ar', origin: 'https://seif-online.com' }));
    expect(absolute).toBe('<link rel="prev" href="https://seif-online.com/ar/product/skin-care"/><link rel="next" href="https://seif-online.com/ar/product/skin-care?page=3"/>');
  });
});

describe('ownPageAlternates (our pages without a backend Seo: brands, categories indexes)', () => {
  it('itself as canonical, every language, x-default the Arabic page', () => {
    expect(ownPageAlternates(routes.brands, 'en')).toEqual({ canonical: '/en/brands', languages: { en: '/en/brands', ar: '/ar/brands', 'x-default': '/ar/brands' } });
    expect(ownPageAlternates(routes.allCategories, 'ar')).toEqual({
      canonical: '/ar/all-categories',
      languages: { en: '/en/all-categories', ar: '/ar/all-categories', 'x-default': '/ar/all-categories' },
    });
  });
});

describe('content page titles (the old storefront: "<page> - <store>")', () => {
  const page = (title: string): Seo => ({ ...seo, title, openGraph: null });

  it('adds the store name when the backend title is the page name, in English and Arabic', () => {
    expect(contentPageSeo(page('About Us'), 'About Us', 'Seif Pharmacies').title).toBe('About Us - Seif Pharmacies');
    expect(contentPageSeo(page('عن الشركة'), 'عن الشركة', 'صيدليات سيف').title).toBe('عن الشركة - صيدليات سيف');
    expect(seoMetadata(contentPageSeo(page('About Us'), 'About Us', 'Seif Pharmacies'), 'en').title).toEqual({ absolute: 'About Us - Seif Pharmacies' });
  });

  it("keeps the merchant's own SEO title, and adds nothing without a store name", () => {
    expect(contentPageSeo(page('Who we are at Seif'), 'About Us', 'Seif Pharmacies').title).toBe('Who we are at Seif');
    expect(contentPageSeo(page('About Us'), 'About Us', null).title).toBe('About Us');
    expect(contentPageSeo(page('Seif Pharmacies'), 'Seif Pharmacies', 'Seif Pharmacies').title).toBe('Seif Pharmacies');
  });

  it('gives our own pages the same pattern', () => {
    expect(titleTemplate('Seif Pharmacies')).toBe('%s - Seif Pharmacies');
  });
});
