/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { notFound, permanentRedirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getProduct } from '@/sdk';
import { ensureShopperContext, shopperContext } from '@/lib/shopper.server';
import { productFixture } from '@/test/product-fixtures';
import { answerPath } from '@/lib/resolve.server';
import ProductPage, { generateMetadata } from './ProductPage';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  permanentRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  }),
  usePathname: () => '/en',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/sdk')>()), getProduct: vi.fn() }));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})), loadLayout: vi.fn(async () => ({ features: { share: true } })) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn() }));
vi.mock('@/lib/shopper.actions', () => ({ addToCartAction: vi.fn(), toggleWishlistAction: vi.fn(), toggleCompareAction: vi.fn() }));
vi.mock('./actions', () => ({ notifyMeAction: vi.fn() }));
vi.mock('@/lib/resolve.server', () => ({ answerPath: vi.fn() }));
// JSON-LD reads the request headers (server only): tested in src/lib/jsonld.test.ts.
vi.mock('@/lib/jsonld', () => ({ JsonLd: () => null }));
vi.mock('./blocks', () => ({
  RecommendationsBlock: ({ slug }: { slug: string }) => <div data-testid="recommendations-block" data-slug={slug} />,
  ReviewsBlock: ({ page, baseHref }: { page: number; baseHref: string }) => <div data-testid="reviews-block" data-page={page} data-href={baseHref} />,
}));

const params = (locale: string, slug: string) => Promise.resolve({ locale, slug });
const search = (query: Record<string, string> = {}) => Promise.resolve(query);

async function renderPage(locale: string, slug: string, query: Record<string, string> = {}) {
  render(await ProductPage({ params: params(locale, slug), searchParams: search(query) }));
}

describe('product page', () => {
  beforeEach(() => {
    vi.mocked(getProduct).mockReset();
    vi.mocked(shopperContext).mockImplementation(async (locale) => ({ locale, token: null }));
  });

  it('reads the product with the shopper context and draws it, reviews on the asked page', async () => {
    const details = productFixture('en');
    vi.mocked(getProduct).mockResolvedValue(details);
    await renderPage('en', 'cologne', { page: '3' });

    expect(getProduct).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: null }, 'cologne');
    expect(ensureShopperContext).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: details.product.name })).toBeVisible();
    expect(screen.getByTestId('recommendations-block')).toHaveAttribute('data-slug', details.product.slug);
    expect(screen.getByTestId('reviews-block')).toHaveAttribute('data-page', '3');
    expect(screen.getByTestId('reviews-block')).toHaveAttribute('data-href', `/en/${encodeURIComponent(details.product.slug)}`);
  });

  it('asks for an Arabic slug as the backend wrote it (the route hands it over percent-encoded)', async () => {
    vi.mocked(getProduct).mockResolvedValue(productFixture('ar'));
    await renderPage('ar', encodeURIComponent('كولونيا-احلام'));
    expect(getProduct).toHaveBeenCalledWith(expect.anything(), { locale: 'ar', token: null }, 'كولونيا-احلام');
  });

  it('redirects permanently to the address the backend gave', async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...productFixture('ar'), redirect: { type: 'product', slug: 'كولونيا' } });
    await expect(renderPage('ar', 'cologne')).rejects.toThrow('NEXT_REDIRECT');
    expect(permanentRedirect).toHaveBeenCalledWith(`/ar/${encodeURIComponent('كولونيا')}`);
  });

  it('is not found when the backend knows the slug as nothing', async () => {
    vi.mocked(getProduct).mockRejectedValue(new ApiError('not_found', 404, 'Not found.'));
    vi.mocked(answerPath).mockResolvedValue({ kind: 'not_found' });
    await expect(renderPage('en', 'nope')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('moves a root slug that is a category, CMS page or brand to its page (the old one-segment URLs)', async () => {
    vi.mocked(getProduct).mockRejectedValue(new ApiError('not_found', 404, 'Not found.'));
    vi.mocked(answerPath).mockResolvedValue({ kind: 'redirect', location: '/en/product/skin-care', status: 301 });
    await expect(renderPage('en', 'skin-care', { utm_source: 'x' })).rejects.toThrow('NEXT_REDIRECT /en/product/skin-care');
    const [locale, requested] = vi.mocked(answerPath).mock.lastCall!;
    expect([locale, requested.pathname + requested.search]).toEqual(['en', '/en/skin-care?utm_source=x']);
  });

  it('says the store is unavailable when the API is down', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getProduct).mockRejectedValue(new ApiError('server', 500, 'Down.'));
    await renderPage('en', 'cologne');
    expect(screen.getByRole('alert')).toHaveTextContent('The store is taking a break');
    log.mockRestore();
  });

  it('takes the page meta from the backend seo block', async () => {
    const details = productFixture('en');
    vi.mocked(getProduct).mockResolvedValue(details);
    const meta = await generateMetadata({ params: params('en', details.product.slug) });
    expect(meta.title).toEqual({ absolute: details.seo.title });
    expect(meta.description).toBe(details.seo.description);
    expect(meta.alternates?.canonical).toBe(`/en/${encodeURIComponent(details.product.slug)}`);

    vi.mocked(getProduct).mockRejectedValue(new ApiError('not_found', 404, 'Not found.'));
    expect(await generateMetadata({ params: params('en', 'nope') })).toMatchObject({ robots: { index: false } });
  });
});
