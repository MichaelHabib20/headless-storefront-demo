/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESOLUTION_HEADER } from '@/lib/resolve';
import UnmatchedPage from './page';

vi.mock('next/headers', () => ({ headers: vi.fn() }));

function withHeader(value: string | null) {
  vi.mocked(headers).mockResolvedValue(new Headers(value ? { [RESOLUTION_HEADER]: value } : {}) as unknown as Awaited<ReturnType<typeof headers>>);
}

const page = (locale: string, ...slug: string[]) => UnmatchedPage({ params: Promise.resolve({ locale, slug }) });

describe('unmatched paths', () => {
  beforeEach(() => {
    vi.mocked(notFound).mockReset().mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('draws the "no longer available" page for a path the middleware found gone', async () => {
    withHeader('gone');
    render(await page('ar', 'discontinued-offer'));
    expect(screen.getByRole('heading', { name: 'هذه الصفحة لم تعد متاحة' })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ar');
  });

  it('never trusts the header on the storefront own routes (the middleware does not set it there)', async () => {
    withHeader('gone');
    render(await page('en', 'pages', 'x'));
    expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    await expect(page('en', 'c', 'x', 'y', 'z', 'w')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('keeps "coming soon" only for routes other pages still build; the rest is 404', async () => {
    withHeader(null);
    // track-order is built now (src/app/[locale]/track-order); the content routes are the shell agent's
    for (const section of ['pages', 'l', 'forms']) {
      const { unmount } = render(await page('en', section, 'x'));
      expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
      unmount();
    }
    for (const section of ['p', 'checkout', 'c', 'brands', 'lists', 'deals', 'search', 'something-else']) {
      await expect(page('en', section, 'x', 'y')).rejects.toThrow('NEXT_NOT_FOUND');
    }
  });
});
