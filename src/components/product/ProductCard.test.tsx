/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProductCard as ProductCardData } from '@/sdk';
import { ProductCard } from './ProductCard';

const product = (overrides: Partial<ProductCardData> = {}): ProductCardData => ({
  id: 1,
  slug: 'jj-bath',
  name: 'J&J Bath 500ml',
  image: { url: 'https://cdn.test/jj.webp', alt: null },
  brand: { name: 'JOHNSON & JOHNSON', slug: 'jj', target: { type: 'brand', slug: 'jj' } },
  price: { currency: 'EGP', amount: 150, compareAt: 200, discountPercent: 25 },
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
    expect(card).toHaveTextContent('EGP 150');
    expect(card).toHaveTextContent('EGP 200');
    expect(card).toHaveTextContent('-25%');
    expect(card).toHaveTextContent('JOHNSON & JOHNSON');
  });

  it('shows no compare-at price for full-price products', () => {
    render(<ProductCard product={product({ price: { currency: 'EGP', amount: 18, compareAt: null, discountPercent: null } })} locale="en" />);
    const card = screen.getByTestId('product-card');
    expect(card).toHaveTextContent('EGP 18');
    expect(card.querySelector('s')).toBeNull();
  });

  it('hides the price when the store hides prices', () => {
    render(<ProductCard product={product({ price: null })} locale="en" />);
    expect(screen.getByTestId('product-card')).not.toHaveTextContent('EGP');
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
