/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Home } from '@/sdk';
import { VendorRail } from './VendorRail';

const block: NonNullable<Home['featuredVendors']> = {
  title: 'VENDORS-TITLE-FROM-API',
  items: [
    { id: 3, name: 'Green Farm', image: { url: 'https://cdn.example.test/green.png', alt: 'Green Farm' }, target: { type: 'vendor', id: 3 } },
    { id: 5, name: 'City Pharmacy', image: null, target: { type: 'vendor', id: 5 } },
  ],
};

describe('home vendors block', () => {
  it('draws the backend title and sellers, each opening its products, and links all vendors', () => {
    render(<VendorRail block={block} locale="ar" />);
    const section = screen.getByTestId('home-vendors');
    expect(within(section).getByRole('heading')).toHaveTextContent('VENDORS-TITLE-FROM-API');
    expect(within(section).getByRole('link', { name: 'Green Farm' })).toHaveAttribute('href', '/ar/vendors/3');
    expect(within(section).getByRole('link', { name: 'City Pharmacy' })).toHaveTextContent('City Pharmacy');
    expect(within(section).getByRole('link', { name: 'كل البائعين' })).toHaveAttribute('href', '/ar/vendors');
  });

  it('nothing when the backend sends no block or no sellers', () => {
    const { container, rerender } = render(<VendorRail block={undefined} locale="en" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<VendorRail block={{ ...block, items: [] }} locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });
});
