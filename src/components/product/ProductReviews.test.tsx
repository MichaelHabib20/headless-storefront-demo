/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { reviewsDisabledFixture, reviewsFixture } from '@/test/product-fixtures';
import { ProductReviews, ProductReviewsUnavailable } from './ProductReviews';

describe('ProductReviews', () => {
  it('shows the summary and the page of reviews the backend sent', () => {
    const reviews = reviewsFixture('en');
    const summary = reviews.summary!;
    render(<ProductReviews reviews={reviews} locale="en" baseHref="/en/jj-cologne" />);

    const section = screen.getByRole('region', { name: 'Reviews' });
    expect(section).toHaveAttribute('id', 'reviews');
    expect(screen.getByTestId('reviews-average')).toHaveTextContent('4.1');
    expect(within(section).getByText(`Based on ${summary.count} reviews`)).toBeInTheDocument();

    const rows = screen.getAllByTestId('reviews-distribution-row');
    expect(rows).toHaveLength(summary.distribution.length);
    rows.forEach((row, i) => {
      const { stars, count, percent } = summary.distribution[i];
      expect(row).toHaveTextContent(stars === 1 ? '1 star' : `${stars} stars`);
      expect(row).toHaveTextContent(String(count));
      // the backend's share is the bar width, as it is
      expect((row.querySelector('[style]') as HTMLElement).style.getPropertyValue('--review-share')).toBe(`${percent}%`);
    });

    const items = screen.getAllByTestId('review');
    expect(items).toHaveLength(reviews.items.length);
    reviews.items.forEach((review, i) => {
      expect(within(items[i]).getByText(review.author ?? 'A customer')).toBeInTheDocument();
      expect(within(items[i]).getByRole('img', { name: `Rated ${review.rating} out of 5` })).toBeInTheDocument();
      expect(items[i].querySelector('time')).toHaveAttribute('datetime', review.createdAt);
      if (review.comment) expect(items[i]).toHaveTextContent(review.comment);
    });
    expect(reviews.items.some((review) => review.author === null)).toBe(true);

    const pages = screen.getByRole('navigation', { name: 'Review pages' });
    expect(within(pages).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en/jj-cologne?page=2#reviews');
    expect(within(pages).getByRole('link', { name: `Page ${reviews.pagination.totalPages}` })).toHaveAttribute(
      'href',
      `/en/jj-cologne?page=${reviews.pagination.totalPages}#reviews`,
    );
  });

  it('shows nothing when the store switched reviews off', () => {
    const { container } = render(<ProductReviews reviews={reviewsDisabledFixture('en')} locale="en" baseHref="/en/x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says there are no reviews yet, without a summary or pages', () => {
    const reviews = { enabled: true, summary: null, items: [], pagination: { page: 1, perPage: 5, total: 0, totalPages: 0 } };
    render(<ProductReviews reviews={reviews} locale="en" baseHref="/en/x" />);
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('reviews-summary')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('says so when the reviews could not be loaded', () => {
    render(<ProductReviewsUnavailable locale="ar" />);
    expect(screen.getByRole('region', { name: 'التقييمات' })).toHaveTextContent('تعذر تحميل التقييمات الآن.');
  });

  it('speaks Arabic with Latin digits', () => {
    const reviews = reviewsFixture('ar');
    render(<ProductReviews reviews={reviews} locale="ar" baseHref="/ar/x" />);

    expect(screen.getByRole('heading', { name: 'التقييمات' })).toBeInTheDocument();
    expect(screen.getByTestId('reviews-average')).toHaveTextContent('4.1');
    expect(screen.getByText('بناءً على 23 تقييم')).toBeInTheDocument();
    expect(screen.getAllByTestId('review')[0]).toHaveTextContent(reviews.items[0].comment!);
    expect(screen.getByRole('navigation', { name: 'صفحات التقييمات' })).toBeInTheDocument();
  });
});
