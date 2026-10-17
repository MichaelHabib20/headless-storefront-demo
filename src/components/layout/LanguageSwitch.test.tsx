/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ path: '/en/product/skin-care/face-care', search: 'sort=high&page=2&brand_id=a' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path, useSearchParams: () => new URLSearchParams(nav.search) }));

import { LanguageSwitch } from './LanguageSwitch';
import { PageAlternates } from './PageAlternates';

describe('LanguageSwitch', () => {
  it('opens the same listing in Arabic with its sort, page and filters', () => {
    render(<LanguageSwitch locale="en" label="العربية" ariaLabel="Arabic" />);
    expect(screen.getByRole('link', { name: 'Arabic' })).toHaveAttribute('href', '/ar/product/skin-care/face-care?sort=high&page=2&brand_id=a');
  });

  it('opens the English page from Arabic, query kept', () => {
    nav.path = '/ar/products';
    nav.search = 'search=%D8%A8%D9%8A&price_from=10';
    render(<LanguageSwitch locale="ar" label="English" ariaLabel="English" />);
    const link = screen.getByRole('link', { name: 'English' });
    expect(link).toHaveAttribute('href', '/en/products?search=%D8%A8%D9%8A&price_from=10');
    expect(link).toHaveAttribute('hreflang', 'en');
  });

  it('adds nothing when there is no query', () => {
    nav.path = '/en/cart';
    nav.search = '';
    render(<LanguageSwitch locale="en" label="العربية" ariaLabel="Arabic" />);
    expect(screen.getByRole('link', { name: 'Arabic' })).toHaveAttribute('href', '/ar/cart');
  });

  it('a product with its own slug in each language: the switch opens its English address (round 5, N1)', () => {
    nav.path = `/ar/${encodeURIComponent('شان-لوشن')}`;
    nav.search = '';
    const arabic = { en: '/en/shaan-lotion', ar: `/ar/${encodeURIComponent('شان-لوشن')}` };
    const view = render(
      <>
        <LanguageSwitch locale="ar" label="English" ariaLabel="English" />
        <PageAlternates hrefs={arabic} />
      </>,
    );
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/shaan-lotion');

    // client-side navigation to the English page: its alternates replace the Arabic page's
    nav.path = '/en/shaan-lotion';
    view.rerender(
      <>
        <LanguageSwitch locale="en" label="العربية" ariaLabel="Arabic" />
        <PageAlternates hrefs={arabic} />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Arabic' })).toHaveAttribute('href', arabic.ar);

    // a page without alternates (the cart): the old ones are gone, the locale segment is swapped
    nav.path = '/en/cart';
    view.rerender(<LanguageSwitch locale="en" label="العربية" ariaLabel="Arabic" />);
    expect(screen.getByRole('link', { name: 'Arabic' })).toHaveAttribute('href', '/ar/cart');
    view.unmount();
  });

  it('keeps the page query on the alternate (a category listing sorted and paged)', () => {
    nav.path = '/ar/product/%D8%B9%D9%86%D8%A7%D9%8A%D8%A9';
    nav.search = 'sort=low&page=2';
    render(
      <>
        <LanguageSwitch locale="ar" label="English" ariaLabel="English" />
        <PageAlternates hrefs={{ en: '/en/product/skin-care?page=2', ar: nav.path }} />
      </>,
    );
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/product/skin-care?sort=low&page=2');
  });

  it('ignores alternates left by another page', () => {
    nav.path = '/en/a';
    nav.search = '';
    const view = render(<PageAlternates hrefs={{ ar: '/ar/other-a' }} />);
    nav.path = '/en/b';
    act(() => {
      view.rerender(<LanguageSwitch locale="en" label="العربية" ariaLabel="Arabic" />);
    });
    expect(screen.getByRole('link', { name: 'Arabic' })).toHaveAttribute('href', '/ar/b');
  });
});
