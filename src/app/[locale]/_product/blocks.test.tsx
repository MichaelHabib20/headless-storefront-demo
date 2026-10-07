/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getProductRecommendations, getProductReviews } from '@/sdk';
import { shopperContext } from '@/lib/shopper.server';
import { recommendationsFixture, reviewsFixture } from '@/test/product-fixtures';
import { RecommendationsBlock, REVIEWS_PER_PAGE, ReviewsBlock } from './blocks';

vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  getProductRecommendations: vi.fn(),
  getProductReviews: vi.fn(),
}));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn() }));
vi.mock('@/lib/shopper.actions', () => ({ addToCartAction: vi.fn(), toggleWishlistAction: vi.fn(), toggleCompareAction: vi.fn() }));
vi.mock('@/lib/reviews.actions', () => ({ writeReviewAction: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/jj-cologne' }));

const reviewsProps = { productId: 9822, productName: 'JJ Cologne' };

describe('product page blocks', () => {
  beforeEach(() => {
    vi.mocked(shopperContext).mockImplementation(async (locale) => ({ locale, token: 'guest-1' }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('loads the recommendations with the shopper context', async () => {
    vi.mocked(getProductRecommendations).mockResolvedValue(recommendationsFixture('en'));
    render((await RecommendationsBlock({ locale: 'en', slug: 'jj-cologne' }))!);
    expect(getProductRecommendations).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'guest-1' }, 'jj-cologne');
    expect(screen.getAllByTestId('product-recommendations')).toHaveLength(2);
  });

  it('shows nothing when the recommendations fail', async () => {
    vi.mocked(getProductRecommendations).mockRejectedValue(new ApiError('server', 500, 'Down.'));
    expect(await RecommendationsBlock({ locale: 'en', slug: 'jj-cologne' })).toBeNull();
  });

  it('loads the asked page of reviews, and says so when they fail', async () => {
    vi.mocked(getProductReviews).mockResolvedValue(reviewsFixture('en'));
    const { unmount } = render(await ReviewsBlock({ locale: 'en', slug: 'jj-cologne', page: 2, baseHref: '/en/jj-cologne', ...reviewsProps }));
    // the shopper token goes along so `write` says whether THIS shopper may write a review
    expect(getProductReviews).toHaveBeenCalledWith(expect.anything(), 'en', 'jj-cologne', { page: 2, perPage: REVIEWS_PER_PAGE }, 'guest-1');
    expect(screen.getAllByTestId('review')).toHaveLength(5);
    unmount();

    vi.mocked(getProductReviews).mockRejectedValue(new ApiError('network', 0, 'offline'));
    render(await ReviewsBlock({ locale: 'en', slug: 'jj-cologne', page: 1, baseHref: '/en/jj-cologne', ...reviewsProps }));
    expect(screen.getByText('Reviews could not be loaded right now.')).toBeInTheDocument();
  });

  it('draws the "write a review" entry point from reviews.write', async () => {
    const reviews = reviewsFixture('en');
    vi.mocked(getProductReviews).mockResolvedValue({ ...reviews, write: { enabled: true, requiresSignIn: false, requiresOrder: false, message: null } });
    const { unmount } = render(await ReviewsBlock({ locale: 'en', slug: 'jj-cologne', page: 1, baseHref: '/en/jj-cologne', ...reviewsProps }));
    expect(screen.getByTestId('write-review')).toBeInTheDocument();
    unmount();

    vi.mocked(getProductReviews).mockResolvedValue({ ...reviews, write: undefined });
    render(await ReviewsBlock({ locale: 'en', slug: 'jj-cologne', page: 1, baseHref: '/en/jj-cologne', ...reviewsProps }));
    expect(screen.queryByTestId('write-review')).toBeNull();
  });
});
