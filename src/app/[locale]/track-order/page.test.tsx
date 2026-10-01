/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTrackedOrder } from '@/lib/account.server';
import { loadLayout } from '@/lib/storefront.server';
import { layoutFixture } from '@/test/fixtures';
import { trackedOrderFixture } from '@/test/account-fixtures';
import TrackOrderPage from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));
vi.mock('@/lib/account.server', () => ({ loadTrackedOrder: vi.fn() }));
vi.mock('@/lib/storefront.server', () => ({ loadLayout: vi.fn() }));

const params = (locale: string) => Promise.resolve({ locale });
const query = (value: Record<string, string> = {}) => Promise.resolve(value);

function layoutWithTracking(on: boolean) {
  const layout = layoutFixture('en');
  return { ...layout, features: { ...layout.features, orderTracking: on } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadLayout).mockResolvedValue(layoutWithTracking(true));
});

describe('track-order page', () => {
  it('is a plain GET form when nothing was typed, and never calls the API', async () => {
    render(await TrackOrderPage({ params: params('en'), searchParams: query() }));
    expect(screen.getByRole('heading', { level: 1, name: 'Track your order' })).toBeInTheDocument();
    const form = screen.getByTestId('track-order-form');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/en/track-order');
    expect(loadTrackedOrder).not.toHaveBeenCalled();
  });

  it('shows the order the API found, read-only (Arabic)', async () => {
    const order = trackedOrderFixture('ar');
    vi.mocked(loadTrackedOrder).mockResolvedValue({ status: 'ok', data: order });
    render(await TrackOrderPage({ params: params('ar'), searchParams: query({ number: '48200', phone: '01000000001' }) }));
    expect(loadTrackedOrder).toHaveBeenCalledWith('ar', '48200', '01000000001');
    expect(screen.getByTestId('order')).toHaveAttribute('data-order-id', order.id);
    expect(screen.getByLabelText('رقم الطلب')).toHaveValue('48200');
    expect(screen.queryByTestId('order-actions')).toBeNull();
  });

  it("shows the not-found message when the pair doesn't match (also when the store has tracking off at the API)", async () => {
    vi.mocked(loadTrackedOrder).mockResolvedValue({ status: 'not-found' });
    render(await TrackOrderPage({ params: params('en'), searchParams: query({ number: '1', phone: '2' }) }));
    expect(screen.getByTestId('track-order-not-found')).toHaveTextContent('We could not find an order');
    expect(screen.queryByTestId('order')).toBeNull();
  });

  it('is 404 while the layout says the store has no order tracking', async () => {
    vi.mocked(loadLayout).mockResolvedValue(layoutWithTracking(false));
    await expect(TrackOrderPage({ params: params('en'), searchParams: query() })).rejects.toThrow('NOT_FOUND');
  });
});
