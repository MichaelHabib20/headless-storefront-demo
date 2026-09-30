/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { recommendationsFixture } from '@/test/product-fixtures';
import { ProductRecommendations } from './ProductRecommendations';

vi.mock('@/lib/shopper.actions', () => ({ addToCartAction: vi.fn(), toggleWishlistAction: vi.fn(), toggleCompareAction: vi.fn() }));

describe('ProductRecommendations', () => {
  it('shows each row the backend sent, in its order, with its title and cards', () => {
    const { sections } = recommendationsFixture('en');
    render(<ProductRecommendations sections={sections} locale="en" />);

    const rows = screen.getAllByTestId('product-recommendations');
    expect(rows.map((row) => row.getAttribute('data-key'))).toEqual(sections.map((s) => s.key));
    rows.forEach((row, i) => {
      expect(within(row).getByRole('heading', { level: 2 })).toHaveTextContent(sections[i].title);
      expect(within(row).getAllByTestId('product-card')).toHaveLength(sections[i].products.length);
    });
  });

  it('shows the bought-together total as the backend wrote it, and none for other rows', () => {
    const { sections } = recommendationsFixture('en');
    render(<ProductRecommendations sections={sections} locale="en" />);

    const together = sections.findIndex((s) => s.total);
    const rows = screen.getAllByTestId('product-recommendations');
    expect(within(rows[together]).getByTestId('together-total').textContent).toBe(sections[together].total!.display);
    expect(rows[together]).toHaveTextContent('Price for all');
    expect(within(rows[0]).queryByTestId('together-total')).toBeNull();
  });

  it('renders nothing without sections', () => {
    const { container } = render(<ProductRecommendations sections={[]} locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('speaks Arabic', () => {
    const { sections } = recommendationsFixture('ar');
    render(<ProductRecommendations sections={sections} locale="ar" />);
    expect(screen.getByRole('heading', { name: sections[0].title })).toBeInTheDocument();
    expect(screen.getByTestId('together-total').textContent).toBe(sections[1].total!.display);
    expect(screen.getByText('السعر للكل')).toBeInTheDocument();
  });
});
