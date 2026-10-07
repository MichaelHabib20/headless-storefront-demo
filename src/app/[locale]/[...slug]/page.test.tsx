/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESOLUTION_HEADER } from '@/lib/resolve';
import ProductPage from '../_product/ProductPage';
import UnmatchedPage from './page';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('../_product/ProductPage', () => ({ default: vi.fn(async () => <p>product page</p>), generateMetadata: vi.fn(async () => ({})) }));

function withHeader(value: string | null) {
  vi.mocked(headers).mockResolvedValue(new Headers(value ? { [RESOLUTION_HEADER]: value } : {}) as unknown as Awaited<ReturnType<typeof headers>>);
}

const page = (locale: string, ...slug: string[]) => UnmatchedPage({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve({ page: '2' }) });

describe('the catch-all route', () => {
  beforeEach(() => {
    vi.mocked(ProductPage).mockClear();
    vi.mocked(notFound).mockReset().mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('shows a product at the old storefront address /{locale}/{slug}', async () => {
    withHeader(null);
    render(await page('ar', '%D8%A8%D8%A7%D9%86%D8%A7%D8%AF%D9%88%D9%84'));
    expect(screen.getByText('product page')).toBeInTheDocument();
    const props = vi.mocked(ProductPage).mock.calls[0][0];
    expect(await props.params).toEqual({ locale: 'ar', slug: '%D8%A8%D8%A7%D9%86%D8%A7%D8%AF%D9%88%D9%84' });
    expect(await props.searchParams).toEqual({ page: '2' });
  });

  it('never takes a reserved first segment for a product', async () => {
    withHeader(null);
    for (const segment of ['brand', 'blog', 'category', 'not-found', 'p', 'deals']) {
      await expect(page('en', segment)).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(ProductPage).not.toHaveBeenCalled();
  });

  it('draws the "no longer available" page for a path the middleware found gone', async () => {
    withHeader('gone');
    render(await page('ar', 'not-found', 'gone'));
    expect(screen.getByRole('heading', { name: 'هذه الصفحة لم تعد متاحة' })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ar');
  });

  it('never trusts the header on the storefront own routes (the middleware does not set it there)', async () => {
    withHeader('gone');
    await expect(page('en', 'product', 'a', 'b', 'c', 'd')).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(page('en', 'account', 'x')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('is a 404 for deeper paths no page matched', async () => {
    withHeader(null);
    for (const section of ['products', 'checkout', 'pages', 'forms', 'session', 'something-else']) {
      await expect(page('en', section, 'x', 'y', 'z')).rejects.toThrow('NEXT_NOT_FOUND');
    }
  });
});
