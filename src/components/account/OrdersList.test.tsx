/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ordersFixture } from '@/test/account-fixtures';
import { OrdersList } from './OrdersList';

describe('OrdersList', () => {
  it.each([
    ['en', 'Order #48201', 'September 28, 2026', 'Order pages'],
    ['ar', 'طلب رقم 48201', '٢٨ سبتمبر ٢٠٢٦', 'صفحات الطلبات'],
  ] as const)('shows each order as the API sent it (%s)', (locale, number, date, pages) => {
    const orders = ordersFixture(locale);
    render(<OrdersList orders={orders} locale={locale} timeZone="UTC" />);

    const rows = screen.getAllByTestId('order-summary');
    expect(rows).toHaveLength(orders.items.length);
    const first = within(rows[0]);
    expect(first.getByRole('link', { name: number })).toHaveAttribute('href', `/${locale}/account/orders/mock-order-48201`);
    expect(rows[0]).toHaveTextContent(date);
    expect(first.getByTestId('order-status')).toHaveTextContent(orders.items[0].status.label);
    orders.items.forEach((order, index) => {
      expect(within(rows[index]).getByTestId('order-total').textContent).toBe(order.total.display);
    });
    expect(screen.getByRole('navigation', { name: pages })).toBeInTheDocument();
  });

  it('counts items in the page digits', () => {
    render(<OrdersList orders={ordersFixture('ar')} locale="ar" timeZone="UTC" />);
    expect(within(screen.getAllByTestId('order-summary')[0]).getByTestId('order-item-count')).toHaveTextContent('٣');
  });

  it('styles statuses by code and draws unknown codes the default way', () => {
    render(<OrdersList orders={ordersFixture('en')} locale="en" timeZone="UTC" />);
    const statuses = screen.getAllByTestId('order-status');
    expect(statuses.map((node) => node.getAttribute('data-tone'))).toContain('default');
    const returned = statuses.find((node) => node.getAttribute('data-status') === 'returned')!;
    expect(returned).toHaveTextContent('Returned');
    expect(returned).toHaveAttribute('data-tone', 'default');
  });

  it('shows an empty state without orders', () => {
    render(<OrdersList orders={{ items: [], pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 } }} locale="en" />);
    expect(screen.getByTestId('orders-empty')).toHaveTextContent('No orders yet');
    expect(screen.queryByTestId('pagination')).toBeNull();
  });
});
