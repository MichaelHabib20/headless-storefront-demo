/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { productsFixture } from '@/test/fixtures';
import { ListingView } from './ListingView';

const noFacets = (locale: 'en' | 'ar') => ({ ...productsFixture(locale), facets: [] });

function fields(form: HTMLElement) {
  return [...form.querySelectorAll('input')].map((input) => [input.name, input.type, input.value]);
}

describe('Search and Price (always there, like the old storefront)', () => {
  it('a category without side filters: Search opens the search page, Price keeps sort and filters', () => {
    const current = 'sort=high&brand_id=jj&price_from=100&page=3';
    render(<ListingView listing={noFacets('en')} locale="en" links={{ path: '/en/product/mom-baby' }} current={current} />);

    const search = screen.getByTestId('listing-search');
    expect(within(search).getByRole('heading', { name: 'Search' })).toBeInTheDocument();
    const searchForm = within(search).getByRole('search');
    expect(searchForm).toHaveAttribute('action', '/en/products');
    expect(fields(searchForm)).toEqual([['search', 'search', '']]);
    expect(within(search).getByRole('searchbox', { name: 'Search in the products' })).toBeInTheDocument();

    const price = screen.getByTestId('price-filter');
    expect(within(price).getByRole('heading', { name: 'Price' })).toBeInTheDocument();
    const form = screen.getByTestId('price-form');
    expect(form).toHaveAttribute('action', '/en/product/mom-baby');
    // the page's other parameters ride along; the price and the page are the form's own
    expect(fields(form)).toEqual([
      ['sort', 'hidden', 'high'],
      ['brand_id', 'hidden', 'jj'],
      ['price_from', 'number', '100'],
      ['price_to', 'number', ''],
    ]);
    expect(within(form).getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(within(form).getByRole('link', { name: 'Clear' })).toHaveAttribute('href', '/en/product/mom-baby?sort=high&brand_id=jj');
  });

  it('the search page: Search changes the text in place and keeps the rest; v3 names are read too', () => {
    render(<ListingView listing={noFacets('en')} locale="en" links={{ path: '/en/products', keep: { search: 'baby' } }} current="search=baby&sort=low&priceMin=5&page=2" />);
    const searchForm = within(screen.getByTestId('listing-search')).getByRole('search');
    expect(searchForm).toHaveAttribute('action', '/en/products');
    expect(fields(searchForm)).toEqual([
      ['sort', 'hidden', 'low'],
      ['price_from', 'hidden', '5'],
      ['search', 'search', 'baby'],
    ]);
    expect(fields(screen.getByTestId('price-form'))).toEqual([
      ['search', 'hidden', 'baby'],
      ['sort', 'hidden', 'low'],
      ['price_from', 'number', '5'],
      ['price_to', 'number', ''],
    ]);
    expect(screen.getByTestId('price-clear')).toHaveAttribute('href', '/en/products?search=baby&sort=low');
  });

  it('the order of the panel: Search, Price, then the tree sections and facets', () => {
    const { container } = render(<ListingView listing={noFacets('en')} locale="en" links={{ path: '/en/all-products' }} />);
    const panel = screen.getByTestId('listing-filters');
    const first = [...panel.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid')).filter((id) => ['listing-search', 'price-filter'].includes(id!));
    expect(first).toEqual(['listing-search', 'price-filter']);
    expect(container.querySelector('[data-testid="price-clear"]')).toHaveAttribute('href', '/en/all-products');
  });

  it('the backend range facet replaces the own Price section (no two price forms)', () => {
    const listing = productsFixture('en');
    expect(listing.facets.some((facet) => facet.kind === 'range')).toBe(true);
    render(<ListingView listing={listing} locale="en" links={{ path: '/en/product/mom-baby' }} />);
    expect(screen.queryByTestId('price-filter')).toBeNull();
    expect(screen.getByTestId('range-form')).toBeInTheDocument();
    expect(screen.getByTestId('listing-search')).toBeInTheDocument();
  });

  it('Arabic', () => {
    render(<ListingView listing={noFacets('ar')} locale="ar" links={{ path: '/ar/product/mom-baby' }} />);
    expect(within(screen.getByTestId('listing-search')).getByRole('heading', { name: 'بحث' })).toBeInTheDocument();
    expect(within(screen.getByTestId('listing-search')).getByRole('search')).toHaveAttribute('action', '/ar/products');
    const price = screen.getByTestId('price-filter');
    expect(within(price).getByRole('heading', { name: 'السعر' })).toBeInTheDocument();
    expect(within(price).getByRole('spinbutton', { name: 'من' })).toBeInTheDocument();
    expect(within(price).getByRole('spinbutton', { name: 'إلى' })).toBeInTheDocument();
    expect(within(price).getByRole('button', { name: 'تطبيق' })).toBeInTheDocument();
    expect(within(price).getByRole('link', { name: 'إزالة' })).toHaveAttribute('href', '/ar/product/mom-baby');
  });
});
