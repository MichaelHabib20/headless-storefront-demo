/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Money as MoneyValue, Price as PriceValue } from '@/sdk';
import { DiscountLabel, Money, Price } from '.';
import { messagesForTest } from './messages';

/*
 * The texts are deliberately odd and the numbers deliberately wrong: the components must show
 * the backend's text exactly and never read the numbers.
 */
const money = (display: string): MoneyValue => ({ amount: 123, currency: 'EGP', display });

const discounted = (overrides: Partial<PriceValue> = {}): PriceValue => ({
  currency: 'EGP',
  amount: 123,
  compareAt: 456,
  discountPercent: 7,
  display: 'PRICE-TEXT-1',
  compareAtDisplay: 'OLD-PRICE-TEXT-1',
  discountLabel: 'DISCOUNT-TEXT-1',
  ...overrides,
});

const fullPrice = (): PriceValue => discounted({ compareAt: null, discountPercent: null, compareAtDisplay: null, discountLabel: null });

describe('Money', () => {
  it('shows the display text as it is', () => {
    render(<Money value={money('MONEY-TEXT-1')} data-testid="total" />);
    expect(screen.getByTestId('total')).toHaveTextContent(/^MONEY-TEXT-1$/);
    expect(screen.getByTestId('total')).not.toHaveTextContent('123');
  });

  it('shows Arabic text as it is', () => {
    render(<Money value={money('1,260.00 جنية')} data-testid="total" />);
    expect(screen.getByTestId('total').textContent).toBe('1,260.00 جنية');
  });

  it('takes the element and class from the caller', () => {
    render(
      <dl>
        <Money value={money('MONEY-TEXT-2')} as="dd" className="my-total" data-testid="total" />
      </dl>,
    );
    const total = screen.getByTestId('total');
    expect(total.tagName).toBe('DD');
    expect(total).toHaveClass('my-total');
  });

  it('renders nothing for null', () => {
    const { container } = render(<Money value={null} data-testid="total" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Price', () => {
  it('shows a discounted price: the price, the old price struck through and the discount', () => {
    render(<Price price={discounted()} locale="en" data-testid="price" />);
    const price = screen.getByTestId('price');

    expect(price).toHaveTextContent('PRICE-TEXT-1');
    expect(price.querySelector('s')).toHaveTextContent('OLD-PRICE-TEXT-1');
    expect(price).toHaveTextContent('DISCOUNT-TEXT-1');
    // what a screen reader reads, with the hidden labels
    expect(price).toHaveTextContent(/^Now PRICE-TEXT-1 Was OLD-PRICE-TEXT-1 DISCOUNT-TEXT-1$/);
    for (const number of ['123', '456', '7%']) expect(price).not.toHaveTextContent(number);
  });

  it('labels the prices in Arabic', () => {
    render(<Price price={discounted({ display: '150 جنية', compareAtDisplay: '200 جنية', discountLabel: '25 % خصم' })} locale="ar" data-testid="price" />);
    const price = screen.getByTestId('price');

    expect(price).toHaveTextContent('السعر الحالي 150 جنية');
    expect(price.querySelector('s')).toHaveTextContent('السعر قبل الخصم 200 جنية');
    expect(price).toHaveTextContent('25 % خصم');
  });

  it('shows only the price when there is no discount', () => {
    render(<Price price={fullPrice()} locale="en" data-testid="price" />);
    const price = screen.getByTestId('price');

    expect(price).toHaveTextContent(/^PRICE-TEXT-1$/);
    expect(price.querySelector('s')).toBeNull();
  });

  it('renders nothing when the store hides prices', () => {
    const { container } = render(<Price price={null} locale="en" data-testid="price" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('takes the look from the caller: element, class and a class per part', () => {
    const classNames = { amount: 'my-amount', sale: 'my-sale', compareAt: 'my-old', discount: 'my-discount' };
    const { rerender } = render(<Price price={discounted()} locale="en" as="p" className="my-price" classNames={classNames} data-testid="price" />);
    const price = screen.getByTestId('price');

    expect(price.tagName).toBe('P');
    expect(price).toHaveClass('my-price');
    expect(price.querySelector('.my-amount')).toHaveClass('my-sale');
    expect(price.querySelector('.my-amount')).toHaveTextContent('PRICE-TEXT-1');
    expect(price.querySelector('s.my-old')).toHaveTextContent('OLD-PRICE-TEXT-1');
    expect(price.querySelector('.my-discount')).toHaveTextContent('DISCOUNT-TEXT-1');

    rerender(<Price price={fullPrice()} locale="en" classNames={classNames} data-testid="price" />);
    expect(screen.getByTestId('price').querySelector('.my-amount')).not.toHaveClass('my-sale');
  });

  it('leaves the discount out when it is shown elsewhere', () => {
    render(<Price price={discounted()} locale="en" showDiscount={false} data-testid="price" />);
    expect(screen.getByTestId('price')).not.toHaveTextContent('DISCOUNT-TEXT-1');
  });

  it('renders on the server (no hooks, no browser APIs)', () => {
    const html = renderToStaticMarkup(<Price price={discounted()} locale="ar" as="p" />);
    expect(html).toContain('PRICE-TEXT-1');
    expect(html).toContain('<s');
  });
});

describe('DiscountLabel', () => {
  it('shows the discount text alone', () => {
    render(<DiscountLabel price={discounted()} className="badge" data-testid="discount" />);
    expect(screen.getByTestId('discount')).toHaveTextContent(/^DISCOUNT-TEXT-1$/);
    expect(screen.getByTestId('discount')).toHaveClass('badge');
  });

  it('renders nothing without a discount or a price', () => {
    const { container } = render(
      <>
        <DiscountLabel price={fullPrice()} />
        <DiscountLabel price={null} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('money labels', () => {
  it('exist in English and Arabic', () => {
    expect(Object.keys(messagesForTest.ar).sort()).toEqual(Object.keys(messagesForTest.en).sort());
    for (const value of Object.values(messagesForTest.ar)) expect(value.trim()).not.toBe('');
  });
});
