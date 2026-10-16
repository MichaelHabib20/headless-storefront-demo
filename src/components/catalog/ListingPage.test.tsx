/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCategoryTree, loadListing } from '@/lib/catalog.server';
import { categoriesFixture, productsFixture } from '@/test/fixtures';
import { ListingPage } from './ListingPage';

vi.mock('@/lib/catalog.server', () => ({ loadListing: vi.fn(), loadCategoryTree: vi.fn() }));
// JSON-LD reads the request headers (server only): tested in src/lib/jsonld.test.ts.
vi.mock('@/lib/jsonld', () => ({ JsonLd: () => null }));

const props = { locale: 'en' as const, scope: { q: 'bath' }, params: { search: 'bath', priceMin: 'abc' }, links: { path: '/en/products', keep: { search: 'bath' } } };

describe('ListingPage', () => {
  beforeEach(() => {
    vi.mocked(loadListing).mockReset();
    vi.mocked(notFound).mockReset();
    vi.mocked(loadCategoryTree).mockReset();
    vi.mocked(loadCategoryTree).mockImplementation(async (locale) => categoriesFixture(locale));
  });

  it('passes the scope and every page parameter to the loader, and draws the listing', async () => {
    vi.mocked(loadListing).mockResolvedValue({ status: 'ok', listing: productsFixture('en') });
    render(await ListingPage(props));
    expect(loadListing).toHaveBeenCalledWith('en', { q: 'bath' }, { search: 'bath', priceMin: 'abc' });
    expect(screen.getByTestId('listing')).toBeInTheDocument();
  });

  it('draws the Categories and Sub category sections from the tree, even when the backend sends no facets', async () => {
    const tree = categoriesFixture('en');
    const category = tree.items.find((node) => node.children.some((child) => child.children.length))!;
    const group = category.children.find((child) => child.children.length)!;
    const sub = group.children[0];
    vi.mocked(loadListing).mockResolvedValue({ status: 'ok', listing: { ...productsFixture('en'), facets: [] } });
    const { container } = render(await ListingPage({ locale: 'en', scope: { category: sub.target.path }, params: {}, links: { path: '/en/product/x' } }));
    const sections = container.querySelectorAll('[data-testid="category-filter"]');
    expect([...sections].map((section) => section.getAttribute('data-section'))).toEqual(['categories', 'sub-categories']);
    const selected = [...container.querySelectorAll('[data-testid="category-filter-value"][data-selected="true"]')].map((link) => link.textContent);
    expect(selected).toEqual([`${category.name}selected`, `${group.name}selected`, `${sub.name}selected`]);
    expect(loadCategoryTree).toHaveBeenCalledTimes(1);
  });

  it('looks the path up in the other language tree when the own one does not have it (English slugs on /ar)', async () => {
    const en = categoriesFixture('en');
    const ar = categoriesFixture('ar');
    const enCategory = en.items[0];
    vi.mocked(loadCategoryTree).mockImplementation(async (locale) => (locale === 'ar' ? { items: ar.items.map((node) => ({ ...node, target: { type: 'category' as const, path: [`ar-${node.target.path[0]}`] } })) } : en));
    vi.mocked(loadListing).mockResolvedValue({ status: 'ok', listing: { ...productsFixture('ar'), facets: [] } });
    const { container } = render(await ListingPage({ locale: 'ar', scope: { category: enCategory.target.path }, params: {}, links: { path: '/ar/product/x' } }));
    expect(loadCategoryTree).toHaveBeenCalledWith('en');
    const selected = container.querySelector('[data-section="categories"] [data-selected="true"]');
    expect(selected).toHaveTextContent(ar.items.find((node) => node.id === enCategory.id)!.name);
  });

  it('no category sections on a custom list, like the old storefront', async () => {
    vi.mocked(loadListing).mockResolvedValue({ status: 'ok', listing: { ...productsFixture('en'), facets: [] } });
    const { container } = render(await ListingPage({ locale: 'en', scope: { list: 'best-sellers' }, params: {}, links: { path: '/en/products/list/best-sellers' } }));
    expect(loadCategoryTree).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="category-filter"]')).toBeNull();
    // Search and Price stay, as on the old storefront's lists
    expect(screen.getByTestId('listing-filters')).toBeInTheDocument();
    expect(screen.getByTestId('listing-search')).toBeInTheDocument();
    expect(screen.getByTestId('price-filter')).toBeInTheDocument();
  });

  it('the sections go away quietly when the tree does not load', async () => {
    vi.mocked(loadCategoryTree).mockResolvedValue(null);
    vi.mocked(loadListing).mockResolvedValue({ status: 'ok', listing: productsFixture('en') });
    const { container } = render(await ListingPage(props));
    expect(container.querySelector('[data-testid="category-filter"]')).toBeNull();
    expect(screen.getByTestId('listing-filters')).toBeInTheDocument();
  });

  it('shows the backend message when it refuses the parameters, with a way back', async () => {
    vi.mocked(loadListing).mockResolvedValue({ status: 'invalid', message: 'Some filters are not valid.' });
    render(await ListingPage(props));
    expect(screen.getByRole('alert')).toHaveTextContent('Some filters are not valid.');
    expect(screen.getByRole('link', { name: 'Show everything' })).toHaveAttribute('href', '/en/products?search=bath');
  });

  it('offers a retry of the same page when the API is down', async () => {
    vi.mocked(loadListing).mockResolvedValue({ status: 'error' });
    render(await ListingPage(props));
    expect(screen.getByTestId('listing-error')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en/products?search=bath&price_from=abc');
  });

  it('an unknown scope is a 404', async () => {
    vi.mocked(loadListing).mockResolvedValue({ status: 'not_found' });
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    await expect(ListingPage(props)).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
