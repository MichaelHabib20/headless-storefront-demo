/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Locale, ProductListing } from '@/sdk';
import { categoriesFixture, emptyProductsFixture, productsFixture } from '@/test/fixtures';
import { categoryFilters, findCategoryChain } from '@/lib/category-filters';
import { toOldQuery } from '@/lib/listing';
import { ListingView } from './ListingView';

const PATH = { en: '/en/product/mom-baby', ar: '/ar/product/mom-baby' };

/** This page + the backend's query in the old storefront's names (`brands` → `brand_id`, ...). */
const href = (query: string) => (query ? `${PATH.en}?${toOldQuery(query)}` : PATH.en);

function renderListing(listing: ProductListing, locale: Locale = 'en', extra: { keep?: Record<string, string>; current?: string } = {}) {
  return render(<ListingView listing={listing} locale={locale} links={{ path: PATH[locale], keep: extra.keep }} current={extra.current} />);
}

describe('ListingView', () => {
  it.each(['en', 'ar'] as const)('draws what the API sent (%s)', (locale) => {
    const listing = productsFixture(locale);
    const { container } = renderListing(listing, locale);

    expect(screen.getByRole('heading', { level: 1, name: listing.context.title })).toBeInTheDocument();
    expect(screen.getByTestId('listing-description').innerHTML).toBe(listing.context.description!.html);
    expect([...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toContain(listing.context.image!.url);
    expect(screen.getAllByTestId('product-card')).toHaveLength(listing.items.length);
    // prices exactly as the backend wrote them
    const prices = screen.getAllByTestId('product-price');
    listing.items.forEach((item, i) => expect(prices[i]).toHaveTextContent(item.price!.display));
    // breadcrumbs, the last one is the current page
    const trail = screen.getByRole('navigation', { name: locale === 'en' ? 'Breadcrumb' : 'مسار التصفح' });
    expect(within(trail).getAllByRole('listitem')).toHaveLength(listing.breadcrumbs.length);
  });

  it('shows the result count from pagination', () => {
    renderListing(productsFixture('en'));
    expect(screen.getByTestId('listing-count')).toHaveTextContent(`Results: ${productsFixture('en').pagination.total}`);
    renderListing({ ...productsFixture('ar'), pagination: { page: 1, perPage: 2, total: 12, totalPages: 6 } }, 'ar');
    expect(screen.getAllByTestId('listing-count')[1]).toHaveTextContent('النتائج: 12');
  });

  it('a listing capped at page 50 counts what its pages can show (reachable), not the full total', () => {
    const capped = { page: 1, perPage: 24, total: 2217, totalPages: 50, reachable: 1200 };
    renderListing({ ...productsFixture('en'), pagination: capped });
    expect(screen.getByTestId('listing-count')).toHaveTextContent('Results: 1,200');
    renderListing({ ...productsFixture('ar'), pagination: capped }, 'ar');
    expect(screen.getAllByTestId('listing-count')[1]).toHaveTextContent('النتائج: 1,200');
  });

  it('every filter value, sort option, chip and "clear all" links to this page + the query the backend wrote, in the old names', () => {
    const listing = productsFixture('en');
    renderListing(listing);

    const values = screen.getAllByTestId('facet-value');
    const expected = listing.facets.filter((f) => f.kind === 'options').flatMap((f) => f.values);
    expect(values).toHaveLength(expected.length);
    values.forEach((link, i) => {
      expect(link).toHaveAttribute('href', href(expected[i].query));
      expect(link).toHaveAttribute('data-selected', String(expected[i].selected));
    });

    const sort = screen.getByTestId('sort');
    listing.sort.forEach((option) => {
      expect(within(sort).getByRole('link', { name: option.label })).toHaveAttribute('href', href(option.query));
    });
    expect(within(sort).getByRole('link', { name: listing.sort.find((s) => s.selected)!.label })).toHaveAttribute('aria-current', 'true');

    const chip = listing.appliedFilters[0];
    expect(screen.getByRole('link', { name: `Remove filter: ${chip.label}` })).toHaveAttribute('href', href(chip.removeQuery));
    expect(screen.getByRole('link', { name: 'Clear all' })).toHaveAttribute('href', href(listing.clearFiltersQuery ?? ''));
    // e.g. the fixture's color + sort link
    expect(screen.getByRole('link', { name: /Name: A/ }).getAttribute('href')).toBe(`${PATH.en}?options_values_ids=color-lavender&sort=a-z`);
  });

  it('draws facet values by their display hint and skips unknown kinds', () => {
    const listing = productsFixture('en');
    const color = listing.facets.find((f) => f.display === 'color')!;
    const unknown = { ...color, key: 'mystery', label: 'Mystery', kind: 'slider' as unknown as 'options' };
    const { container } = renderListing({ ...listing, facets: [...listing.facets, unknown] });

    const colorGroup = container.querySelector(`[data-facet="${color.key}"]`)!;
    const swatches = colorGroup.querySelectorAll<HTMLElement>('[aria-hidden="true"][style]');
    expect(swatches).toHaveLength(color.values.length);
    expect(swatches[0].style.backgroundColor).not.toBe('');
    expect(container.querySelector('[data-facet="mystery"]')).toBeNull();
    // the selected value says so to screen readers
    expect(within(colorGroup as HTMLElement).getAllByText('selected')).toHaveLength(color.values.filter((v) => v.selected).length);
  });

  it('the price range is a GET form with the typed numbers and the backend query as hidden fields', () => {
    const listing = productsFixture('en');
    const range = listing.facets.find((f) => f.kind === 'range')!.range!;
    renderListing(listing, 'en', { keep: { q: 'bath' } });

    const form = screen.getByTestId('range-form') as HTMLFormElement;
    const hidden = [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((i) => [i.name, i.value]);
    expect(hidden).toEqual([['q', 'bath'], ...new URLSearchParams(toOldQuery(range.query))]);
    expect(screen.getByLabelText('From')).toHaveAttribute('name', 'price_from');
    expect(screen.getByLabelText('To')).toHaveAttribute('name', 'price_to');
    expect(screen.getByTestId('range-bounds')).toHaveTextContent(`${range.min!.display} – ${range.max!.display}`);
  });

  it('page links keep the current query and change only the page', () => {
    const listing = productsFixture('en');
    const current = 'options_values_ids=color-lavender&sort=low&perPage=2';
    renderListing(listing, 'en', { current });
    const pages = screen.getByRole('navigation', { name: 'Result pages' });
    expect(within(pages).getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', `${PATH.en}?${current}&page=2`);
    expect(within(pages).getByRole('link', { name: /Next/ })).toHaveAttribute('href', `${PATH.en}?${current}&page=2`);
  });

  it('keeps q on every link of the search page', () => {
    const listing = productsFixture('en');
    renderListing(listing, 'en', { keep: { q: 'baby bath' } });
    for (const link of screen.getAllByTestId('facet-value')) expect(link.getAttribute('href')).toMatch(/\?q=baby\+bath(&|$)/);
  });

  it.each(['en', 'ar'] as const)('shows the empty state with a way out (%s)', (locale) => {
    const listing = emptyProductsFixture(locale);
    renderListing(listing, locale);
    const empty = screen.getByTestId('listing-empty');
    expect(within(empty).getByRole('heading', { name: locale === 'en' ? 'No products found' : 'لا توجد منتجات' })).toBeInTheDocument();
    expect(within(empty).getByRole('link')).toHaveAttribute('href', `/${locale}/all-products`);
    // no facets: still Search and Price, like the old storefront
    expect(screen.getByTestId('listing-search')).toBeInTheDocument();
    expect(screen.getByTestId('price-filter')).toBeInTheDocument();
  });

  it('offers to clear the filters when filters emptied the list', () => {
    renderListing({ ...productsFixture('en'), items: [], clearFiltersQuery: 'sort=price_asc' });
    expect(within(screen.getByTestId('listing-empty')).getByRole('link', { name: 'Clear all filters' })).toHaveAttribute('href', `${PATH.en}?sort=low`);
  });

  it('opens the filters as a dialog on phones and closes with Escape', async () => {
    const user = userEvent.setup();
    renderListing(productsFixture('en'));
    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(toggle);
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('button', { name: 'Close filters' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Show results' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ListingView: the Categories / Sub category sections from the tree', () => {
  const sectionsOf = (container: HTMLElement) => [...container.querySelectorAll('[data-testid="category-filter"]')].map((section) => [section.getAttribute('data-section'), section.querySelector('summary')?.textContent, section.hasAttribute('open')]);

  it.each([
    ['en', 'Categories', 'Sub category'],
    ['ar', 'فئات', 'تصنيف فرعي للفئات'],
  ] as const)('show as links to the tree nodes with no facets at all, the page’s category selected (%s)', (locale, categoriesTitle, subTitle) => {
    const tree = categoriesFixture(locale);
    const category = tree.items.find((node) => node.children.some((child) => child.children.length))!;
    const group = category.children.find((child) => child.children.length)!;
    const sub = group.children[0];
    const filters = categoryFilters(tree, findCategoryChain(tree, sub.target.path));
    const { container } = render(<ListingView listing={{ ...productsFixture(locale), facets: [] }} locale={locale} links={{ path: PATH[locale] }} categories={filters} />);

    expect(screen.getByTestId('listing-filters')).toBeInTheDocument();
    expect(sectionsOf(container)).toEqual([
      ['categories', categoriesTitle, true],
      ['sub-categories', subTitle, true],
    ]);
    const links = [...container.querySelectorAll<HTMLAnchorElement>('[data-section="categories"] a')];
    expect(links).toHaveLength(tree.items.length);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(tree.items.map((node) => `/${locale}/product/${node.target.path.join('/')}`));
    // real links search engines may follow (no rel=nofollow, unlike the filter values)
    expect(links.every((link) => !link.hasAttribute('rel'))).toBe(true);
    const current = container.querySelector('[data-section="categories"] [aria-current="page"]');
    expect(current).toBeNull(); // the page is the sub-category, not the category
    const subs = container.querySelector('[data-section="sub-categories"]')!;
    const ticked = [...subs.querySelectorAll('[data-selected="true"]')].map((link) => link.getAttribute('href'));
    // the group heading (its own page) and the ticked sub-category, which unticks back to the category
    expect(ticked).toEqual([`/${locale}/product/${group.target.path.join('/')}`, `/${locale}/product/${category.target.path.join('/')}`]);
  });

  it('a category page has the Sub category section closed, its category current', () => {
    const tree = categoriesFixture('en');
    const category = tree.items.find((node) => node.children.length)!;
    const { container } = render(<ListingView listing={{ ...productsFixture('en'), facets: [] }} locale="en" links={{ path: PATH.en }} categories={categoryFilters(tree, [category])} />);
    expect(sectionsOf(container).map(([key, , open]) => [key, open])).toEqual([
      ['categories', true],
      ['sub-categories', false],
    ]);
    expect(container.querySelector('[data-section="categories"] [aria-current="page"]')).toHaveTextContent(category.name);
  });

  it('keeps the backend facets, and drops Sub category when the backend sends its own categories facet', () => {
    const tree = categoriesFixture('en');
    const listing = productsFixture('en');
    expect(listing.facets.some((facet) => facet.key === 'category')).toBe(true);
    const { container } = render(<ListingView listing={listing} locale="en" links={{ path: PATH.en }} categories={categoryFilters(tree, [tree.items[1]])} />);
    expect(sectionsOf(container).map(([key]) => key)).toEqual(['categories']);
    expect(screen.getAllByTestId('facet')).toHaveLength(listing.facets.length);
  });
});
