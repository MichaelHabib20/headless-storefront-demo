/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { reorderFixture } from '@/test/account-fixtures';
import { keepReorderNotice } from './reorder-notice';
import { ReorderNotice } from './ReorderNotice';

afterEach(() => window.sessionStorage.clear());

describe('ReorderNotice (cart page)', () => {
  it.each([
    ['en', 'These items could not be added:'],
    ['ar', 'تعذرت إضافة هذه المنتجات:'],
  ] as const)('lists what the API skipped, with its names and reasons (%s)', async (locale, heading) => {
    const { skipped } = reorderFixture(locale);
    keepReorderNotice(skipped);
    render(<ReorderNotice locale={locale} />);

    const notice = await screen.findByTestId('reorder-notice');
    expect(notice).toHaveTextContent(heading);
    const items = screen.getAllByTestId('reorder-skipped');
    skipped.forEach((item, index) => {
      expect(items[index]).toHaveTextContent(item.name);
      expect(items[index]).toHaveTextContent(item.reason);
    });
  });

  it('only says the items were added when nothing was skipped', async () => {
    keepReorderNotice([]);
    render(<ReorderNotice locale="en" />);
    expect(await screen.findByTestId('reorder-notice')).toHaveTextContent('The items of your order were added to your cart.');
    expect(screen.queryByTestId('reorder-skipped')).toBeNull();
  });

  it('shows nothing on a normal visit to the cart', () => {
    render(<ReorderNotice locale="en" />);
    expect(screen.queryByTestId('reorder-notice')).toBeNull();
  });
});
