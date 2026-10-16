/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cartFixture, productsFixture } from '@/test/fixtures';
import { CartLineItem } from '../cart/CartLineItem';
import { ProductCard } from '../product/ProductCard';
import { PLACEHOLDER_IMAGE, ProductImage } from './ProductImage';

describe('ProductImage', () => {
  it('shows the picture while it loads, then the store placeholder when the file is missing', () => {
    render(<ProductImage src="https://cdn.example/613153.webp" alt="Shaan lotion" />);
    const img = screen.getByRole('img', { name: 'Shaan lotion' });
    expect(img).toHaveAttribute('src', 'https://cdn.example/613153.webp');
    expect(img).not.toHaveAttribute('data-placeholder');

    fireEvent.error(img);
    expect(img).toHaveAttribute('src', PLACEHOLDER_IMAGE);
    expect(img).toHaveAttribute('data-placeholder', 'true');
    expect(img).toHaveAttribute('alt', 'Shaan lotion');
  });

  it('shows the placeholder (decorative) when the API sent no picture', () => {
    const { container } = render(<ProductImage src={null} alt="x" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', PLACEHOLDER_IMAGE);
    expect(img).toHaveAttribute('alt', '');
  });

  it('is an image, not the browser icon, on product cards and cart lines', () => {
    const product = productsFixture('en').items[0];
    const { container, unmount } = render(<ProductCard product={{ ...product, image: { url: 'https://cdn.example/404.webp', alt: null } }} locale="en" showActions={false} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toHaveAttribute('src', PLACEHOLDER_IMAGE);
    unmount();

    const item = cartFixture('ar').items[0];
    const line = render(<CartLineItem item={{ ...item, product: { ...item.product, image: null } }} locale="ar" />);
    expect(line.container.querySelector('img')).toHaveAttribute('src', PLACEHOLDER_IMAGE);
  });
});
