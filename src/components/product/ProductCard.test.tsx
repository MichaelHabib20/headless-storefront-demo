/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProductCard as ProductCardData } from '@/sdk';
import { homeFixture } from '@/test/fixtures';
import { ProductCard } from './ProductCard';

const product = (overrides: Partial<ProductCardData> = {}): ProductCardData => ({
  id: 1,
  slug: 'jj-bath',
  name: 'J&J Bath 500ml',
  image: { url: 'https://cdn.test/jj.webp', alt: null },
  brand: { name: 'JOHNSON & JOHNSON', slug: 'jj', target: { type: 'brand', slug: 'jj' } },
  // odd texts and numbers on purpose: the card shows the backend's text, never the numbers
  price: { currency: 'EGP', amount: 150, compareAt: 200, discountPercent: 25, display: 'PRICE-TEXT-1', compareAtDisplay: 'OLD-PRICE-TEXT-1', discountLabel: 'DISCOUNT-TEXT-1' },
  inStock: true,
  badges: [],
  rating: null,
  requiresPrescription: false,
  purchase: { canAddToCart: true, minQuantity: 1, maxQuantity: 5 },
  target: { type: 'product', slug: 'jj-bath' },
  ...overrides,
});

describe('ProductCard', () => {
  it('links to the product page and shows backend prices', () => {
    render(<ProductCard product={product()} locale="en" />);
    const card = screen.getByTestId('product-card');

    expect(within(card).getByRole('link')).toHaveAttribute('href', '/en/p/jj-bath');
    expect(card).toHaveTextContent('PRICE-TEXT-1');
    expect(card.querySelector('s')).toHaveTextContent('OLD-PRICE-TEXT-1');
    expect(card).toHaveTextContent('JOHNSON & JOHNSON');
    for (const number of ['150', '200', '25']) expect(card).not.toHaveTextContent(number);
  });

  it('shows the discount once, as the badge on the image', () => {
    render(<ProductCard product={product()} locale="en" />);
    const discount = screen.getByText('DISCOUNT-TEXT-1');
    expect(discount.className).toContain('discount');
    expect(discount.closest('[class*="media"]')).not.toBeNull();
  });

  it('shows no compare-at price for full-price products', () => {
    const price = { currency: 'EGP', amount: 18, compareAt: null, discountPercent: null, display: 'PRICE-TEXT-2', compareAtDisplay: null, discountLabel: null };
    render(<ProductCard product={product({ price })} locale="en" />);
    const card = screen.getByTestId('product-card');
    expect(card).toHaveTextContent('PRICE-TEXT-2');
    expect(card.querySelector('s')).toBeNull();
    expect(card.querySelector('[class*="discount"]')).toBeNull();
  });

  it('shows the Arabic price text from the API', () => {
    const recorded = homeFixture('ar').sections.flatMap((section) => section.products)[0];
    render(<ProductCard product={recorded} locale="ar" />);
    expect(screen.getByTestId('product-card')).toHaveTextContent(recorded.price!.display);
  });

  it('hides the price when the store hides prices', () => {
    render(<ProductCard product={product({ price: null })} locale="en" />);
    const card = screen.getByTestId('product-card');
    expect(card).not.toHaveTextContent('PRICE-TEXT');
    expect(card).not.toHaveTextContent('DISCOUNT-TEXT');
  });

  it('marks out-of-stock and prescription products', () => {
    render(<ProductCard product={product({ inStock: false, requiresPrescription: true })} locale="en" />);
    const card = screen.getByTestId('product-card');
    expect(card).toHaveTextContent('Out of stock');
    expect(card).toHaveTextContent('Prescription required');
  });

  it('renders badges from the backend and translates generic ones', () => {
    render(
      <ProductCard
        product={product({ badges: [{ kind: 'label', text: 'Best seller', color: null }, { kind: 'preorder', text: null, color: null }] })}
        locale="ar"
      />,
    );
    const card = screen.getByTestId('product-card');
    expect(card).toHaveTextContent('Best seller');
    expect(card).toHaveTextContent('طلب مسبق');
    expect(within(card).getByRole('link')).toHaveAttribute('href', '/ar/p/jj-bath');
  });
});
