/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale, Order } from '@/sdk';
import { deliveredOrderFixture, orderFixture, ratedOrderFixture } from '@/test/account-fixtures';
import { OrderDetails } from './OrderDetails';
import type { WriteReviewAction } from './ReviewDialog';
import type { CancelOrderAction, RateOrderAction, ReorderAction } from './types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/en' }));

function setup(order: Order, locale: Locale = 'en') {
  const rateAction = vi.fn<RateOrderAction>();
  const writeReviewAction = vi.fn<WriteReviewAction>();
  render(
    <OrderDetails
      order={order}
      locale={locale}
      reasons={null}
      cancelAction={vi.fn<CancelOrderAction>()}
      reorderAction={vi.fn<ReorderAction>()}
      rateAction={rateAction}
      writeReviewAction={writeReviewAction}
      timeZone="UTC"
    />,
  );
  return { rateAction, writeReviewAction };
}

const stopNavigation = (event: Event) => {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
};
beforeEach(() => document.addEventListener('click', stopNavigation));
afterEach(() => document.removeEventListener('click', stopNavigation));

describe('order rating (from the API)', () => {
  it('offers to rate only when the API allows it, with the fields of ratingForm', () => {
    const order = deliveredOrderFixture('en');
    expect(order.actions.canRate).toBe(true);
    setup(order);

    fireEvent.click(screen.getByRole('button', { name: 'Rate this order' }));
    const dialog = screen.getByRole('dialog', { name: 'Rate your order' });
    expect(within(dialog).getByTestId('stars-rating')).toBeInTheDocument();
    // ratingForm.driverRating = optional on a delivery order, items = true
    expect(within(dialog).getByTestId('stars-driverRating')).toBeInTheDocument();
    expect(within(dialog).getByTestId('rate-items')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send my rating' })).toBeDisabled();
  });

  it('hides the delivery stars when ratingForm says so and the product rows when items is false', () => {
    const order = deliveredOrderFixture('en');
    setup({ ...order, ratingForm: { driverRating: 'hidden', items: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Rate this order' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByTestId('stars-driverRating')).toBeNull();
    expect(within(dialog).queryByTestId('rate-items')).toBeNull();
  });

  it('sends the stars, the delivery stars, the text and the product ratings it chose', async () => {
    const order = deliveredOrderFixture('en');
    const { rateAction } = setup(order);
    rateAction.mockResolvedValue({ ok: true, message: 'Thank you for rating your order.' });

    fireEvent.click(screen.getByRole('button', { name: 'Rate this order' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(within(dialog).getByTestId('stars-rating')).getByLabelText('4 stars'));
    fireEvent.click(within(within(dialog).getByTestId('stars-driverRating')).getByLabelText('5 stars'));
    fireEvent.change(within(dialog).getByLabelText('Tell us more (optional)'), { target: { value: ' Fast ' } });
    const firstProduct = order.items.find((item) => typeof item.productId === 'number')!;
    fireEvent.click(within(within(dialog).getByTestId(`stars-item-${firstProduct.productId}`)).getByLabelText('3 stars'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send my rating' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(rateAction).toHaveBeenCalledWith('en', order.id, {
      rating: 4,
      driverRating: 5,
      feedback: 'Fast',
      skip: false,
      items: [{ productId: firstProduct.productId, rating: 3, comment: null }],
    });
    expect(screen.getByTestId('order-rating-status')).toHaveTextContent('Thank you for rating your order.');
  });

  it('"not now" sends skip and closes quietly', async () => {
    const { rateAction } = setup(deliveredOrderFixture('ar'), 'ar');
    rateAction.mockResolvedValue({ ok: true, message: '' });
    fireEvent.click(screen.getByRole('button', { name: 'قيّم هذا الطلب' }));
    fireEvent.click(screen.getByRole('button', { name: 'ليس الآن' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(rateAction).toHaveBeenCalledWith('ar', expect.any(String), { rating: null, skip: true });
    expect(screen.queryByTestId('order-rating-status')).toBeNull();
  });

  it('shows the rating the API has, and no button', () => {
    const order = ratedOrderFixture('en');
    expect(order.actions.canRate).toBe(false);
    setup(order);
    const panel = screen.getByTestId('order-rating');
    expect(within(panel).getByRole('img', { name: 'Rated 5 out of 5' })).toBeInTheDocument();
    expect(within(panel).getByTestId('order-rating-feedback')).toHaveTextContent(order.rating!.feedback!);
    expect(within(panel).queryByRole('button')).toBeNull();
  });

  it("shows the backend's refusal (409 already_rated)", async () => {
    const { rateAction } = setup(deliveredOrderFixture('en'));
    rateAction.mockResolvedValue({ ok: false, message: 'You have already rated this order.' });
    fireEvent.click(screen.getByRole('button', { name: 'Rate this order' }));
    fireEvent.click(within(screen.getByTestId('stars-rating')).getByLabelText('1 star'));
    fireEvent.click(screen.getByRole('button', { name: 'Send my rating' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You have already rated this order.');
  });

  it('renders no rating panel on an order that cannot be rated and has no rating', () => {
    setup(orderFixture('en'));
    expect(screen.queryByTestId('order-rating')).toBeNull();
  });
});

describe('product reviews from an order', () => {
  it('offers "write a review" on the lines of a delivered order, only for products that still exist', async () => {
    const order = deliveredOrderFixture('en');
    expect(order.actions.canReviewProducts).toBe(true);
    const { writeReviewAction } = setup(order);
    writeReviewAction.mockResolvedValue({ ok: true, message: 'Thank you! Your review will show once it is approved.' });

    const buttons = screen.getAllByTestId('item-review');
    expect(buttons).toHaveLength(order.items.filter((item) => typeof item.productId === 'number').length);

    fireEvent.click(buttons[0]);
    const dialog = screen.getByRole('dialog', { name: `Review ${order.items[0].name}` });
    fireEvent.click(within(within(dialog).getByTestId('stars-rating')).getByLabelText('5 stars'));
    fireEvent.change(within(dialog).getByLabelText('Your review'), { target: { value: 'Great product' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send review' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writeReviewAction).toHaveBeenCalledWith('en', { productId: order.items[0].productId, rating: 5, comment: 'Great product', orderId: order.id });
    expect(screen.getByTestId('item-review-done')).toHaveTextContent('Thank you! Your review will show once it is approved.');
  });

  it('offers no review button when the API says the order cannot be reviewed', () => {
    setup(orderFixture('en'));
    expect(screen.queryByTestId('item-review')).toBeNull();
  });
});

describe('read-only order (tracking page)', () => {
  it('shows no actions, no rating panel and no review buttons without the actions', () => {
    render(<OrderDetails order={deliveredOrderFixture('en')} locale="en" timeZone="UTC" />);
    expect(screen.queryByTestId('order-actions')).toBeNull();
    expect(screen.queryByTestId('order-rating')).toBeNull();
    expect(screen.queryByTestId('item-review')).toBeNull();
  });
});
