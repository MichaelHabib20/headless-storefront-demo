/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadListing } from '@/lib/catalog.server';
import { productsFixture } from '@/test/fixtures';
import { ListingPage } from './ListingPage';

vi.mock('@/lib/catalog.server', () => ({ loadListing: vi.fn() }));
// JSON-LD reads the request headers (server only): tested in src/lib/jsonld.test.ts.
vi.mock('@/lib/jsonld', () => ({ JsonLd: () => null }));

const props = { locale: 'en' as const, scope: { q: 'bath' }, params: { search: 'bath', priceMin: 'abc' }, links: { path: '/en/products', keep: { search: 'bath' } } };

describe('ListingPage', () => {
  beforeEach(() => {
    vi.mocked(loadListing).mockReset();
    vi.mocked(notFound).mockReset();
  });

  it('passes the scope and every page parameter to the loader, and draws the listing', async () => {
    vi.mocked(loadListing).mockResolvedValue({ status: 'ok', listing: productsFixture('en') });
    render(await ListingPage(props));
    expect(loadListing).toHaveBeenCalledWith('en', { q: 'bath' }, { search: 'bath', priceMin: 'abc' });
    expect(screen.getByTestId('listing')).toBeInTheDocument();
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
