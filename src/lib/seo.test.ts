import { describe, expect, it } from 'vitest';
import type { Seo } from '@/sdk';
import { seoMetadata } from './seo';

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
      title: 'Controloc 40 mg',
      description: 'For heartburn.',
      alternates: { canonical: '/en/p/controloc-40', languages: { en: '/en/p/controloc-40', ar: '/ar/p/%D9%83%D9%88%D9%86%D8%AA%D8%B1%D9%88%D9%84%D9%88%D9%83' } },
      robots: undefined,
    });
  });

  it('tells search engines not to index when the backend says so', () => {
    const meta = seoMetadata({ ...seo, description: null, canonical: null, alternates: [], index: false }, 'ar');

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.description).toBeUndefined();
    expect(meta.alternates).toEqual({ canonical: undefined, languages: undefined });
  });
});
