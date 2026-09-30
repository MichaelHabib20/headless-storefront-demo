/** @vitest-environment jsdom */
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutResult } from '@/sdk';
import { checkoutResultFixture } from '@/test/checkout-fixtures';
import { CheckoutResultView } from './CheckoutResultView';
import { ResultPoller } from './ResultPoller';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/en/checkout/result' }));

const status = () => screen.getByTestId('checkout-result').getAttribute('data-status');

describe('CheckoutResultView', () => {
  beforeEach(() => router.refresh.mockClear());

  it('placed: thanks the shopper and shows the order as the backend sent it (en)', () => {
    const result = checkoutResultFixture('placed', 'en');
    const order = result.order!;
    render(<CheckoutResultView result={result} locale="en" />);

    expect(status()).toBe('placed');
    expect(screen.getByRole('heading', { level: 1, name: 'Thank you for your order' })).toBeVisible();
    expect(screen.getByText(result.message!)).toBeVisible();
    expect(screen.getByTestId('result-order-number').textContent).toBe(order.number);
    expect(screen.getByTestId('result-fulfilment').textContent).toBe(order.fulfilment.address);
    expect(screen.getByTestId('result-payment').textContent).toBe(order.payment.method);
    expect(screen.getByText('Ring the bell twice')).toBeVisible();

    const items = screen.getAllByTestId('result-item');
    expect(items).toHaveLength(order.items.length);
    expect(items[0]).toHaveTextContent(order.items[0].name);
    expect(items[0]).toHaveTextContent(order.items[0].lineTotal.display);
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^\/en\/p\//));

    expect(screen.getAllByTestId('checkout-total-line').map((line) => line.textContent)).toEqual(order.totals.lines.map((line) => `${line.label}${line.amount?.display ?? line.text}`));
    expect(screen.getByTestId('checkout-total').textContent).toBe(order.totals.total.display);
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', `/en/account/orders/${order.id}`);
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en');
  });

  it('paid: the same thank-you, in Arabic, with a pickup branch', () => {
    const result = checkoutResultFixture('placed', 'ar');
    result.status = 'paid';
    result.order!.fulfilment = { type: 'pickup', address: null, branch: { id: 71, name: 'فرع مدينة نصر', address: '45 شارع مكرم عبيد', phone: null, mapUrl: null } };
    render(<CheckoutResultView result={result} locale="ar" />);

    expect(status()).toBe('paid');
    expect(screen.getByRole('heading', { level: 1, name: 'شكراً لطلبك' })).toBeVisible();
    expect(screen.getByTestId('result-fulfilment')).toHaveTextContent('فرع مدينة نصر — 45 شارع مكرم عبيد');
    expect(screen.getByText('الاستلام من')).toBeVisible();
    expect(screen.getByTestId('checkout-total').textContent).toBe(result.order!.totals.total.display);
    expect(screen.getByRole('link', { name: 'عرض الطلب' })).toHaveAttribute('href', `/ar/account/orders/${result.order!.id}`);
  });

  it('placed without an order still thanks the shopper and links to the orders', () => {
    const result: CheckoutResult = { status: 'placed', message: 'We received your order.', order: null, retry: false };
    render(<CheckoutResultView result={result} locale="en" />);

    expect(screen.queryByTestId('result-order')).toBeNull();
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/en/account/orders');
  });

  it.each(['failed', 'cancelled'] as const)('%s: shows the backend message and a way back to checkout only when it says so', (value) => {
    const result = { ...checkoutResultFixture('failed', 'en'), status: value };
    const { unmount } = render(<CheckoutResultView result={result} locale="en" />);

    expect(status()).toBe(value);
    expect(screen.getByRole('alert')).toHaveTextContent(result.message!);
    expect(screen.getByRole('link', { name: 'Back to checkout' })).toHaveAttribute('href', '/en/checkout');
    expect(screen.queryByText('Thank you for your order')).toBeNull();
    unmount();

    render(<CheckoutResultView result={{ ...result, retry: false }} locale="en" />);
    expect(screen.queryByRole('link', { name: 'Back to checkout' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeVisible();
  });

  it('a status it does not know: the backend message and a link to the orders, no crash', () => {
    const result = { status: 'on_hold', message: 'Your order is on hold.', order: null, retry: false } as unknown as CheckoutResult;
    render(<CheckoutResultView result={result} locale="en" />);

    expect(status()).toBe('unknown');
    expect(screen.getByText('Your order is on hold.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'My orders' })).toBeVisible();
  });

  it('pending: waits with the backend message', () => {
    const result = checkoutResultFixture('pending', 'en');
    render(<CheckoutResultView result={result} locale="en" />);

    expect(status()).toBe('pending');
    expect(screen.getByRole('status')).toHaveTextContent(result.message!);
    expect(screen.queryByTestId('result-order')).toBeNull();
  });
});

describe('ResultPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    router.refresh.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('asks again every few seconds, for a limited time, then says so calmly', () => {
    render(<ResultPoller locale="en" message="We are waiting for the bank." intervalMs={3000} maxChecks={3} />);

    expect(screen.getByRole('status')).toHaveTextContent('We are waiting for the bank.');
    expect(router.refresh).not.toHaveBeenCalled();

    tick(2999);
    expect(router.refresh).not.toHaveBeenCalled();
    tick(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    tick(3000);
    tick(3000);
    expect(router.refresh).toHaveBeenCalledTimes(3);

    // the limit is reached: no more questions, a calm message, and ways out
    tick(30_000);
    expect(router.refresh).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('result-still-pending')).toHaveTextContent('We are still confirming your payment.');
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/en/account/orders');

    act(() => screen.getByRole('button', { name: 'Check again' }).click());
    expect(router.refresh).toHaveBeenCalledTimes(4);
  });

  it('stops asking when it leaves the screen (the server rendered the real result)', () => {
    const { unmount } = render(<ResultPoller locale="ar" message={null} intervalMs={1000} maxChecks={5} />);
    expect(screen.getByRole('heading', { level: 1, name: 'جارٍ تأكيد الدفع' })).toBeVisible();

    tick(1000);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    unmount();
    tick(10_000);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
