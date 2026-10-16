/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cartFixture, layoutFixture, productsFixture } from '@/test/fixtures';
import { CartLineItem } from '../cart/CartLineItem';
import { ListingView } from '../catalog/ListingView';
import { SiteHeader } from '../layout/SiteHeader';
import { StoreLogo } from '../layout/StoreLogo';
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

  it.each(['en', 'ar'] as const)('the category banner of a listing shows the placeholder when its file is missing (%s)', (locale) => {
    const listing = productsFixture(locale);
    render(<ListingView listing={listing} locale={locale} links={{ path: `/${locale}/product/mom-baby` }} />);
    const banner = screen.getByTestId('listing-image');
    expect(banner).toHaveAttribute('src', listing.context.image!.url);
    fireEvent.error(banner);
    expect(banner).toHaveAttribute('src', PLACEHOLDER_IMAGE);
    expect(banner).toHaveAttribute('data-placeholder', 'true');
  });
});

describe('StoreLogo (header)', () => {
  it.each(['en', 'ar'] as const)('a broken logo becomes the store name as text, never the broken-image icon (%s)', (locale) => {
    const layout = layoutFixture(locale);
    const { container } = render(<SiteHeader layout={{ ...layout, store: { ...layout.store, logo: 'https://cdn.example/missing-logo.png' } }} locale={locale} />);
    const logo = screen.getByTestId('store-logo');
    expect(logo).toHaveAttribute('alt', layout.store.name);
    fireEvent.error(logo);
    expect(screen.queryByTestId('store-logo')).toBeNull();
    expect(screen.getByTestId('store-logo-text')).toHaveTextContent(layout.store.name!);
    // still the link home
    expect(screen.getByTestId('store-logo-text').closest('a')).toHaveAttribute('href', `/${locale}`);
    expect(container.querySelector('img[src="https://cdn.example/missing-logo.png"]')).toBeNull();
  });

  it('no logo from the API: the store name', () => {
    render(<StoreLogo src={null} name="Seif Pharmacies" />);
    expect(screen.getByTestId('store-logo-text')).toHaveTextContent('Seif Pharmacies');
  });
});
