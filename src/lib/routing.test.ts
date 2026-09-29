import { describe, expect, it } from 'vitest';
import type { Target } from '@/sdk';
import { resolveTarget, switchLocalePath } from './routing';

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

describe('switchLocalePath', () => {
  it('keeps the path and swaps the locale', () => {
    expect(switchLocalePath('/en/p/jj-bath', 'ar')).toBe('/ar/p/jj-bath');
    expect(switchLocalePath('/ar', 'en')).toBe('/en');
  });
});
