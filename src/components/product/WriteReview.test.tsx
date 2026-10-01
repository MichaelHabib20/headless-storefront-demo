/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewAccess } from '@/sdk';
import type { WriteReviewAction } from '../account/ReviewDialog';
import { WriteReview } from './WriteReview';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/p/panadol' }));

const access = (overrides: Partial<ReviewAccess> = {}): ReviewAccess => ({ enabled: true, requiresSignIn: false, requiresOrder: false, message: null, ...overrides });

function setup(write: ReviewAccess, locale: 'en' | 'ar' = 'en') {
  const writeReviewAction = vi.fn<WriteReviewAction>();
  render(<WriteReview locale={locale} productId={9822} productName="Baby Cologne" access={write} writeReviewAction={writeReviewAction} />);
  return { writeReviewAction };
}

describe('WriteReview (drawn from reviews.write)', () => {
  it('renders nothing when the store takes no reviews', () => {
    setup(access({ enabled: false, message: 'This store does not take reviews.' }));
    expect(screen.queryByTestId('write-review')).toBeNull();
    expect(screen.queryByText('This store does not take reviews.')).toBeNull();
  });

  it("asks to sign in with the API's sentence and a link back to this page", () => {
    setup(access({ requiresSignIn: true, message: 'Sign in to write a review.' }));
    const note = screen.getByTestId('write-review-sign-in');
    expect(note).toHaveTextContent('Sign in to write a review.');
    expect(within(note).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/sign-in?next=%2Fen%2Fp%2Fpanadol');
  });

  it("shows the API's sentence when a delivered order is required", () => {
    setup(access({ requiresOrder: true, message: 'يمكنك تقييم هذا المنتج من أحد طلباتك التي تم توصيلها.' }), 'ar');
    expect(screen.getByTestId('write-review-order')).toHaveTextContent('يمكنك تقييم هذا المنتج من أحد طلباتك التي تم توصيلها.');
    expect(screen.queryByTestId('write-review')).toBeNull();
  });

  it('sends the review and shows the backend thank-you text', async () => {
    const { writeReviewAction } = setup(access());
    writeReviewAction.mockResolvedValue({ ok: true, message: 'Thank you! Your review will show once it is approved.' });

    fireEvent.click(screen.getByTestId('write-review'));
    const dialog = screen.getByRole('dialog', { name: 'Review Baby Cologne' });
    expect(within(dialog).getByRole('button', { name: 'Send review' })).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText('4 stars'));
    fireEvent.change(within(dialog).getByLabelText('Your review'), { target: { value: '  Lovely smell  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send review' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writeReviewAction).toHaveBeenCalledWith('en', { productId: 9822, rating: 4, comment: 'Lovely smell', orderId: null });
    expect(screen.getByTestId('write-review-done')).toHaveTextContent('Thank you! Your review will show once it is approved.');
  });

  it("keeps the dialog open with the backend's refusal", async () => {
    const { writeReviewAction } = setup(access());
    writeReviewAction.mockResolvedValue({ ok: false, message: 'Please check the highlighted fields.', fieldErrors: { comment: 'Write a few words about the product.' } });
    fireEvent.click(screen.getByTestId('write-review'));
    fireEvent.click(screen.getByLabelText('2 stars'));
    fireEvent.change(screen.getByLabelText('Your review'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please check the highlighted fields.');
    expect(screen.getByText('Write a few words about the product.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes with Escape and gives the focus back', () => {
    setup(access());
    const button = screen.getByTestId('write-review');
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });
});
