/** @vitest-environment jsdom */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CompareData, Locale } from '@/sdk';
import { compareFixture } from '@/test/fixtures';
import type { CompareActionResult } from './CompareTable';
import { CompareView } from './CompareView';

const idle = () => vi.fn(async (): Promise<CompareActionResult> => ({ ok: true }));

function renderCompare(locale: Locale, compare: CompareData = compareFixture(locale), onRemove = idle()) {
  return render(<CompareView state={{ status: 'ok', compare }} locale={locale} onRemove={onRemove} />);
}

/** Visible cell texts of a row: [attribute, ...values] */
const cells = (row: HTMLElement) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent);

describe('CompareView', () => {
  it.each(['en', 'ar'] as const)('shows a column per product and a row per attribute (%s)', (locale) => {
    const compare = compareFixture(locale);
    renderCompare(locale, compare);

    const products = screen.getAllByTestId('compare-product');
    expect(products).toHaveLength(compare.products.length);
    compare.products.forEach((product, i) => {
      expect(within(products[i]).getByTestId('product-card')).toHaveTextContent(product.name);
      expect(within(products[i]).getByRole('link')).toHaveAttribute('href', `/${locale}/${product.slug}`);
    });

    const rows = screen.getAllByTestId('compare-row');
    expect(rows).toHaveLength(compare.attributes.length);
    compare.attributes.forEach((attribute, i) => {
      expect(within(rows[i]).getByRole('rowheader')).toHaveTextContent(attribute.name);
    });
  });

  it('shows attribute values in product order and a dash for a missing value (en)', () => {
    renderCompare('en');

    const [brand, type, material] = screen.getAllByTestId('compare-row');
    expect(cells(brand)).toEqual(['Brand', 'JOHNSON & JOHNSON', 'JOHNSON & JOHNSON']);
    expect(cells(type)).toEqual(['Type', 'BEAUTY STORES', 'BEAUTY STORES']);
    expect(cells(material)[0]).toBe('Material');
    expect(cells(material)[1]).toContain('—');
    expect(within(material).getByText('No value')).toHaveClass('visually-hidden');
    expect(cells(material)[2]).toBe('Ref 8412');
  });

  it('shows Arabic attribute names, the dash and the note in Arabic', () => {
    renderCompare('ar');

    expect(screen.getByRole('heading', { level: 1, name: 'مقارنة المنتجات' })).toBeInTheDocument();
    const material = screen.getAllByTestId('compare-row')[2];
    expect(within(material).getByRole('rowheader')).toHaveTextContent('الخامة');
    expect(cells(material)[1]).toContain('—');
    expect(within(material).getByText('لا توجد قيمة')).toBeInTheDocument();
    expect(screen.getByTestId('compare-note')).toHaveTextContent('مقارنة 2 من 4 منتجات');
    expect(screen.getAllByRole('button', { name: /^إزالة/ })).toHaveLength(2);
  });

  it('shows how many products are compared out of the maximum', () => {
    renderCompare('en');
    expect(screen.getByRole('heading', { level: 1, name: 'Compare products' })).toBeInTheDocument();
    expect(screen.getByTestId('compare-note')).toHaveTextContent('Comparing 2 of 4 products');
  });

  it('shows only the count when the store has no maximum', () => {
    renderCompare('en', { ...compareFixture('en'), maxItems: null });
    expect(screen.getByTestId('compare-note')).toHaveTextContent('Products compared: 2');
  });

  it('shows a dash when a row has fewer values than products', () => {
    const compare = compareFixture('en');
    compare.attributes = [{ name: 'Size', values: ['125 ml'] }];
    renderCompare('en', compare);
    const [size] = screen.getAllByTestId('compare-row');
    expect(cells(size)[1]).toBe('125 ml');
    expect(cells(size)[2]).toContain('—');
  });

  it('keeps the table in a keyboard-scrollable region', () => {
    renderCompare('en');
    const region = screen.getByRole('region', { name: 'Product comparison' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('table')).toBeInTheDocument();
  });

  it.each([
    ['en', 'Nothing to compare yet', 'Start shopping'],
    ['ar', 'لا توجد منتجات للمقارنة', 'ابدأ التسوق'],
  ] as const)('shows an empty state for a visitor without a session (%s)', (locale, title, cta) => {
    render(<CompareView state={{ status: 'guest' }} locale={locale} onRemove={idle()} />);
    const empty = screen.getByTestId('compare-empty');
    expect(within(empty).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(empty).getByRole('link', { name: cta })).toHaveAttribute('href', `/${locale}`);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the empty state when nothing is compared', () => {
    renderCompare('en', { products: [], attributes: [], maxItems: 4 });
    expect(screen.getByRole('heading', { name: 'Nothing to compare yet' })).toBeInTheDocument();
    expect(screen.queryByTestId('compare-note')).toBeNull();
  });

  it('says so when the comparison could not be loaded', () => {
    render(<CompareView state={{ status: 'error' }} locale="en" onRemove={idle()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load the comparison');
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en/compare');
  });

  it('hides a removed column at once and brings it back when the API refuses', async () => {
    const user = userEvent.setup();
    let settle!: (result: CompareActionResult) => void;
    const onRemove = vi.fn(() => new Promise<CompareActionResult>((resolve) => (settle = resolve)));
    const [first, second] = compareFixture('en').products;
    renderCompare('en', compareFixture('en'), onRemove);

    await user.click(screen.getByRole('button', { name: `Remove ${first.name}` }));
    expect(onRemove).toHaveBeenCalledWith('en', first.id);
    expect(screen.getAllByTestId('compare-product')).toHaveLength(1);
    expect(screen.getByTestId('compare-product')).toHaveTextContent(second.name);
    // the remaining column keeps its own values
    expect(cells(screen.getAllByTestId('compare-row')[2])).toEqual(['Material', 'Ref 8412']);
    expect(screen.getByTestId('compare-note')).toHaveTextContent('Comparing 1 of 4 products');

    await act(async () => settle({ ok: false, message: 'Not found.' }));
    await waitFor(() => expect(screen.getAllByTestId('compare-product')).toHaveLength(2));
    expect(screen.getByRole('alert')).toHaveTextContent('Not found.');
  });

  it('confirms a removal', async () => {
    const user = userEvent.setup();
    const onRemove = idle();
    const [, second] = compareFixture('ar').products;
    renderCompare('ar', compareFixture('ar'), onRemove);

    await user.click(screen.getByRole('button', { name: `إزالة ${second.name}` }));
    expect(onRemove).toHaveBeenCalledWith('ar', second.id);
    expect(await screen.findByText('تمت الإزالة من المقارنة.')).toBeInTheDocument();
  });
});
