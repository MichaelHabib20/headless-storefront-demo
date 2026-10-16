/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pageHref, pageList, Pagination, positiveIntParam } from './Pagination';

const labels = { nav: 'Wishlist pages', previous: 'Previous', next: 'Next', page: 'Page' };

describe('pageList', () => {
  it('lists every page when there are few', () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(1, 2)).toEqual([1, 2]);
    expect(pageList(2, 3)).toEqual([1, 2, 3]);
    expect(pageList(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows first, last and the neighbours of the current page with gaps between', () => {
    expect(pageList(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(pageList(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageList(10, 10)).toEqual([1, 'gap', 9, 10]);
    expect(pageList(6, 10, 2)).toEqual([1, 'gap', 4, 5, 6, 7, 8, 9, 10]);
  });

  it('never hides a single page behind a gap', () => {
    expect(pageList(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
    expect(pageList(7, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
  });

  it('handles no pages and out-of-range pages', () => {
    expect(pageList(1, 0)).toEqual([]);
    expect(pageList(99, 3)).toEqual([1, 2, 3]);
    expect(pageList(-4, 3)).toEqual([1, 2, 3]);
  });
});

describe('pageHref', () => {
  it('uses the bare URL for page 1 and ?page= for the others', () => {
    expect(pageHref('/en/favorites', 1)).toBe('/en/favorites');
    expect(pageHref('/en/favorites', 3)).toBe('/en/favorites?page=3');
  });

  it('keeps other query parameters and drops undefined ones', () => {
    expect(pageHref('/en/favorites', 2, { perPage: 24, sort: undefined })).toBe('/en/favorites?page=2&perPage=24');
    expect(pageHref('/en/favorites', 1, { perPage: 24 })).toBe('/en/favorites?perPage=24');
    expect(pageHref('/en/favorites', 2, { page: 9 })).toBe('/en/favorites?page=2');
  });
});

describe('positiveIntParam', () => {
  it('reads positive whole numbers', () => {
    expect(positiveIntParam('3', 1)).toBe(3);
    expect(positiveIntParam(['4', '5'], 1)).toBe(4);
  });

  it('falls back for anything else', () => {
    for (const value of [undefined, '', '0', '-2', '1.5', 'abc', '2x', []]) {
      expect(positiveIntParam(value, 1)).toBe(1);
    }
  });

  it('caps at the maximum', () => {
    expect(positiveIntParam('500', 12, 50)).toBe(50);
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination pagination={{ page: 1, totalPages: 1 }} baseHref="/en/favorites" locale="en" labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to the previous, next and numbered pages', () => {
    render(<Pagination pagination={{ page: 2, totalPages: 3 }} baseHref="/en/favorites" query={{ perPage: 2 }} locale="en" labels={labels} />);
    const nav = screen.getByRole('navigation', { name: 'Wishlist pages' });

    expect(within(nav).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en/favorites?perPage=2');
    expect(within(nav).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en/favorites?page=3&perPage=2');
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/en/favorites?perPage=2');
    expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Page 3' })).not.toHaveAttribute('aria-current');
  });

  it('has no previous link on the first page and no next link on the last', () => {
    const { rerender } = render(<Pagination pagination={{ page: 1, totalPages: 2 }} baseHref="/en/favorites" locale="en" labels={labels} />);
    expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en/favorites?page=2');

    rerender(<Pagination pagination={{ page: 2, totalPages: 2 }} baseHref="/en/favorites" locale="en" labels={labels} />);
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en/favorites');
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
  });

  it('can bring the reader back to the list on the new page (fragment)', () => {
    render(<Pagination pagination={{ page: 1, totalPages: 3 }} baseHref="/en/jj-bath" locale="en" labels={labels} fragment="reviews" />);
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en/jj-bath?page=2#reviews');
    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/en/jj-bath#reviews');
  });

  it('marks gaps and shows Latin digits in Arabic', () => {
    render(
      <Pagination
        pagination={{ page: 5, totalPages: 10 }}
        baseHref="/ar/favorites"
        locale="ar"
        labels={{ nav: 'صفحات المفضلة', previous: 'السابق', next: 'التالي', page: 'صفحة' }}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'صفحات المفضلة' });
    expect(within(nav).getAllByText('…')).toHaveLength(2);
    expect(within(nav).getByRole('link', { name: 'صفحة 10' })).toHaveAttribute('href', '/ar/favorites?page=10');
    expect(within(nav).getByRole('link', { name: 'صفحة 5' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'السابق' })).toHaveAttribute('href', '/ar/favorites?page=4');
  });
});
