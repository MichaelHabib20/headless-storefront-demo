/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ path: '/en/product/skin-care/face-care', search: 'sort=high&page=2&brand_id=a' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path, useSearchParams: () => new URLSearchParams(nav.search) }));

import { LanguageSwitch } from './LanguageSwitch';

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
});
