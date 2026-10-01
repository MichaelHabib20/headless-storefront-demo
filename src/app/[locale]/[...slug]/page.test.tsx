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
    await expect(page('en', 'track-order', 'x')).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(page('en', 'c', 'x', 'y', 'z', 'w')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('has no "coming soon" route left after Phase A: deeper paths of every built section are 404', async () => {
    withHeader(null);
    for (const section of ['p', 'checkout', 'c', 'brands', 'lists', 'deals', 'search', 'track-order', 'pages', 'l', 'forms', 'sign-in', 'something-else']) {
      await expect(page('en', section, 'x', 'y')).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(screen.queryByRole('heading', { name: 'Coming soon' })).toBeNull();
  });
});
