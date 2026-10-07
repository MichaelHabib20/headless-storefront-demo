/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CancellationReason, Locale, Order } from '@/sdk';
import { cancellationReasonsFixture, deliveredOrderFixture, orderFixture, pickupOrderFixture, reorderFixture } from '@/test/account-fixtures';
import { OrderDetails } from './OrderDetails';
import type { CancelOrderAction, ReorderAction } from './types';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/en' }));

function setup(order: Order, locale: Locale = 'en', reasons: CancellationReason[] | null = cancellationReasonsFixture(locale).items) {
  const cancelAction = vi.fn<CancelOrderAction>();
  const reorderAction = vi.fn<ReorderAction>();
  render(<OrderDetails order={order} locale={locale} reasons={reasons} cancelAction={cancelAction} reorderAction={reorderAction} timeZone="UTC" />);
  return { cancelAction, reorderAction };
}

const stopNavigation = (event: Event) => {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
};
beforeEach(() => {
  push.mockReset();
  document.addEventListener('click', stopNavigation);
});
afterEach(() => {
  document.removeEventListener('click', stopNavigation);
  window.sessionStorage.clear();
});

describe('OrderDetails', () => {
  it.each(['en', 'ar'] as const)('shows the order exactly as the API describes it (%s)', (locale) => {
    const order = orderFixture(locale);
    setup(order, locale);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(order.number);
    expect(screen.getByTestId('order-status')).toHaveTextContent(order.status.label);
    const steps = within(screen.getByTestId('order-timeline')).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual(order.timeline.map((step) => expect.stringContaining(step.label)));
    expect(steps.find((step) => step.getAttribute('aria-current') === 'step')).toHaveTextContent(order.timeline.find((s) => s.current)!.label);

    expect(screen.getByTestId('order-fulfilment')).toHaveTextContent(order.fulfilment.address!);
    expect(screen.getByTestId('order-payment')).toHaveTextContent(order.payment.method!);

    const items = screen.getAllByTestId('order-item');
    order.items.forEach((item, index) => {
      expect(items[index]).toHaveTextContent(item.name);
      expect(within(items[index]).getByTestId('order-item-total').textContent).toBe(item.lineTotal.display);
      if (item.compareAt) expect(within(items[index]).getByTestId('order-item-compare-at').textContent).toBe(item.compareAt.display);
      else expect(within(items[index]).queryByTestId('order-item-compare-at')).toBeNull();
    });
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', `/${locale}/${encodeURIComponent(order.items[0].target!.slug)}`);

    const lines = screen.getAllByTestId('order-total-line');
    order.totals.lines.forEach((line, index) => {
      expect(lines[index]).toHaveTextContent(line.label);
      expect(lines[index]).toHaveTextContent(line.amount!.display);
    });
    expect(screen.getByTestId('order-grand-total').textContent).toBe(order.totals.total.display);
    expect(screen.getByTestId('order-note')).toHaveTextContent(order.note!);
  });

  it('shows a discount line with the minus sign the API wrote', () => {
    setup(orderFixture('en'));
    const promo = screen.getAllByTestId('order-total-line').find((line) => line.getAttribute('data-kind') === 'promo_code')!;
    expect(promo).toHaveTextContent('-20.00 EGP');
  });

  it('shows the pickup branch, a text instead of an amount, and no timeline', () => {
    const order = pickupOrderFixture('en');
    setup(order);
    const fulfilment = screen.getByTestId('order-fulfilment');
    expect(fulfilment).toHaveTextContent('Pickup branch');
    expect(fulfilment).toHaveTextContent(order.fulfilment.branch!.name);
    expect(within(fulfilment).getByRole('link', { name: 'Open in maps' })).toHaveAttribute('href', order.fulfilment.branch!.mapUrl);
    expect(screen.getAllByTestId('order-total-line').at(-1)).toHaveTextContent('Free');
    expect(screen.queryByTestId('order-timeline')).toBeNull();
  });

  it('shows a product that is not sold any more without a link', () => {
    const order = deliveredOrderFixture('en');
    setup(order);
    const gone = screen.getAllByTestId('order-item').find((node) => node.textContent?.includes('Baby Wipes Travel Pack'))!;
    expect(within(gone).queryByRole('link')).toBeNull();
  });

  it('shows the actions only when the API allows them', () => {
    setup(orderFixture('en'));
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Order again' })).toBeNull();
  });

  it('shows no action button when the API allows none', () => {
    const order = orderFixture('en');
    setup({ ...order, actions: { canCancel: false, canReorder: false } });
    expect(within(screen.getByTestId('order-actions')).queryAllByRole('button')).toHaveLength(0);
  });

  it('cancels with a reason from the API and an optional note', async () => {
    const { cancelAction } = setup(orderFixture('en'));
    cancelAction.mockResolvedValue({ ok: true, message: 'Your order was cancelled.' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this order?' });
    const confirm = within(dialog).getByRole('button', { name: 'Yes, cancel the order' });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getAllByRole('radio')[0]).toHaveFocus();

    fireEvent.click(within(dialog).getByLabelText('I ordered by mistake'));
    fireEvent.change(within(dialog).getByLabelText(/Anything else/), { target: { value: ' Ordered twice ' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(cancelAction).toHaveBeenCalledWith('en', 'mock-order-48201', 2, 'Ordered twice');
    expect(screen.getByTestId('order-actions-status')).toHaveTextContent('Your order was cancelled.');
  });

  it("shows the backend's message when it refuses (409 cannot_cancel)", async () => {
    const { cancelAction } = setup(orderFixture('ar'), 'ar');
    cancelAction.mockResolvedValue({ ok: false, message: 'لم يعد من الممكن إلغاء هذا الطلب.' });
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء الطلب' }));
    fireEvent.click(screen.getByLabelText('غيرت رأيي'));
    fireEvent.click(screen.getByRole('button', { name: 'نعم، ألغِ الطلب' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('لم يعد من الممكن إلغاء هذا الطلب.');
  });

  it('closes the dialog with Escape and gives the focus back', () => {
    const { cancelAction } = setup(orderFixture('en'));
    const button = screen.getByRole('button', { name: 'Cancel order' });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
    expect(cancelAction).not.toHaveBeenCalled();
  });

  it('says so when the reasons could not be loaded', () => {
    setup(orderFixture('en'), 'en', null);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('We could not load the cancellation reasons.');
    expect(screen.queryByRole('button', { name: 'Yes, cancel the order' })).toBeNull();
  });

  it('orders again, keeps what was skipped for the cart page and goes to the cart', async () => {
    const { reorderAction } = setup(deliveredOrderFixture('en'));
    reorderAction.mockResolvedValue({ ok: true, skipped: reorderFixture('en').skipped });

    fireEvent.click(screen.getByRole('button', { name: 'Order again' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/cart'));
    expect(reorderAction).toHaveBeenCalledWith('en', 'mock-order-48200');
    expect(JSON.parse(window.sessionStorage.getItem('sc_reorder_notice')!)).toEqual(reorderFixture('en').skipped);
  });

  it('stays on the order with a message when ordering again fails', async () => {
    const { reorderAction } = setup(deliveredOrderFixture('en'));
    reorderAction.mockResolvedValue({ ok: false, message: 'We could not update your order. Please try again.' });
    fireEvent.click(screen.getByRole('button', { name: 'Order again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not update your order.');
    expect(push).not.toHaveBeenCalled();
  });
});
