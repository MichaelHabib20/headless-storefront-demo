/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Locale, Me, ProductDetails } from '@/sdk';
import { anonymousMeFixture, meFixture } from '@/test/fixtures';
import { discountedProductFixture, outOfStockProductFixture, productFixture } from '@/test/product-fixtures';
import { ShopperStateProvider } from '../shopper/ShopperStateProvider';
import { ProductView } from './ProductView';

vi.mock('@/lib/shopper.actions', () => ({ addToCartAction: vi.fn(), toggleWishlistAction: vi.fn(), toggleCompareAction: vi.fn() }));

const notifyMeAction = vi.fn();
const productHref = (locale: Locale, slug: string) => `/${locale}/${encodeURIComponent(slug)}`;

function renderView(details: ProductDetails, { locale = 'en' as Locale, me = anonymousMeFixture() as Me | null } = {}) {
  return render(
    <ShopperStateProvider me={me} features={{ wishlist: true, compare: true }}>
      <ProductView
        details={details}
        locale={locale}
        notifyMeAction={notifyMeAction}
        recommendations={<div data-testid="recommendations-slot" />}
        reviews={<div data-testid="reviews-slot" />}
      />
    </ShopperStateProvider>,
  );
}

describe('ProductView', () => {
  it('shows what the backend sent for the product', () => {
    const details = productFixture('en');
    const { product } = details;
    renderView(details);

    const title = screen.getByRole('heading', { level: 1, name: product.name });
    expect(title).toBeVisible();
    expect(within(title.closest('header')!).getByRole('link', { name: product.brand!.name })).toHaveAttribute('href', '/en/product/brand/johnson-johnson');
    expect(screen.getByTestId('product-price').textContent).toBe(product.price!.display);
    expect(screen.queryByTestId('product-discount')).toBeNull();

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getAllByRole('listitem')).toHaveLength(details.breadcrumbs.length);
    expect(within(trail).getByRole('link', { name: details.breadcrumbs[1].label })).toHaveAttribute('href', '/en/product/mom-baby');

    expect(screen.getByTestId('product-rating')).toHaveAttribute('href', '#reviews');
    expect(screen.getByRole('img', { name: 'Rated 4.1 out of 5' })).toBeInTheDocument();
    expect(screen.getByTestId('product-rating')).toHaveTextContent(`${product.rating!.count} reviews`);

    const notices = within(screen.getByTestId('product-notices')).getAllByRole('listitem');
    expect(notices.map((n) => n.textContent)).toEqual(details.notices.map((n) => n.text));
    expect(screen.getByTestId('product-summary').innerHTML).toBe(details.summary!.html);
    expect(screen.getByTestId('product-description').innerHTML).toBe(details.description!.html);
    expect(screen.getByTestId('product-sku')).toHaveTextContent(details.sku!);
    expect(screen.queryByTestId('product-availability')).toBeNull();
    expect(screen.queryByTestId('notify-me')).toBeNull();

    const specs = within(screen.getByTestId('product-specifications')).getAllByRole('row');
    expect(specs.map((row) => [within(row).getByRole('rowheader').textContent, within(row).getByRole('cell').textContent])).toEqual(
      details.specifications.map((s) => [s.name, s.value]),
    );

    expect(screen.getByTestId('recommendations-slot')).toBeInTheDocument();
    expect(screen.getByTestId('reviews-slot')).toBeInTheDocument();
  });

  it('draws option values as links to the products the backend chose', () => {
    const details = productFixture('en');
    renderView(details);
    const [size, scent] = details.options;

    const sizeGroup = screen.getByRole('group', { name: size.name });
    expect(sizeGroup.querySelector('[aria-current="true"]')).toHaveTextContent('100 ml, selected');
    expect(within(sizeGroup).getByRole('link', { name: '200 ml' })).toHaveAttribute('href', productHref('en', size.values[1].target!.slug));

    const scentGroup = screen.getByRole('group', { name: scent.name });
    expect(within(scentGroup).getByRole('link', { name: 'Morning Dew, out of stock' })).toHaveAttribute('href', productHref('en', scent.values[1].target!.slug));
    expect(within(scentGroup).getByRole('link', { name: 'Lemon Fresh' })).toHaveAttribute('href', productHref('en', scent.values[2].target!.slug));
    expect(within(scentGroup).getAllByRole('link')).toHaveLength(2);
  });

  it('never makes an unavailable value clickable, even with a target', () => {
    const details = productFixture('en');
    details.options[0].values[1] = { ...details.options[0].values[1], state: 'unavailable' };
    renderView(details);

    expect(screen.queryByRole('link', { name: /200 ml/ })).toBeNull();
    expect(screen.getByText('200 ml').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('200 ml').parentElement).toHaveTextContent('200 ml, not available');
  });

  it('adds with a quantity stepper inside the backend limits', () => {
    renderView(productFixture('en'));
    const group = screen.getByRole('group', { name: productFixture('en').product.name });

    expect(within(group).getByRole('button', { name: 'Add to cart' })).toBeEnabled();
    expect(within(group).getByTestId('product-quantity')).toHaveTextContent('1');
    expect(within(group).getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(within(group).getByRole('button', { name: 'Increase quantity' })).toBeEnabled();
  });

  it('out of stock: the backend message, no add to cart, and notify-me', () => {
    const details = outOfStockProductFixture('en');
    renderView(details);

    expect(screen.getByTestId('product-availability')).toHaveTextContent(details.availability.message!);
    expect(screen.getByTestId('product-availability')).toHaveAttribute('data-status', 'out_of_stock');
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(within(screen.getByTestId('notify-me')).getByRole('button', { name: 'Notify me when available' })).toBeEnabled();
  });

  it('discounted: the price, the old price and the discount as the backend wrote them', () => {
    const details = discountedProductFixture('en');
    renderView(details);

    const price = screen.getByTestId('product-price');
    expect(price).toHaveTextContent(details.product.price!.display);
    expect(price.querySelector('s')).toHaveTextContent(details.product.price!.compareAtDisplay!);
    expect(screen.getByTestId('product-discount').textContent).toBe(details.product.price!.discountLabel);
    expect(within(screen.getByTestId('product-badges')).getByText(details.product.badges[0].text!)).toBeInTheDocument();
  });

  it('shows the dropdown option as a list of links', () => {
    const details = discountedProductFixture('en');
    renderView(details);
    const dropdown = screen.getByTestId('product-option');

    expect(dropdown).toHaveAttribute('data-look', 'dropdown');
    expect(dropdown.querySelector('summary')).toHaveTextContent('Size500 ml');
    expect(dropdown.querySelector('[aria-current="true"]')).toHaveTextContent('500 ml');
    expect(within(dropdown).getByRole('link', { name: '125 ml' })).toHaveAttribute('href', productHref('en', details.options[0].values[0].target!.slug));
  });

  it('leaves out what the backend did not send, and labels badges without text', () => {
    const details = productFixture('en');
    Object.assign(details, { sku: null, description: null, summary: null, specifications: [], notices: [], options: [] });
    details.product.rating = null;
    details.product.requiresPrescription = true;
    details.product.badges = [{ kind: 'coming_soon', text: null, color: null }];
    renderView(details);

    expect(screen.queryByTestId('product-sku')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Description' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Specifications' })).toBeNull();
    expect(screen.queryByTestId('product-notices')).toBeNull();
    expect(screen.queryByTestId('product-options')).toBeNull();
    expect(screen.queryByTestId('product-rating')).toBeNull();
    expect(within(screen.getByTestId('product-badges')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Prescription required', 'Coming soon']);
  });

  it('draws unknown option hints as buttons and unknown states without crashing', () => {
    const details = productFixture('en');
    details.options[1] = { ...details.options[1], display: 'hologram' as never };
    details.options[1].values[2] = { ...details.options[1].values[2], state: 'reserved' as never };
    renderView(details);

    const scent = screen.getAllByTestId('product-option')[1];
    expect(scent).toHaveAttribute('data-look', 'buttons');
    expect(within(scent).getByRole('link', { name: 'Lemon Fresh' })).toBeInTheDocument();
  });

  it('marks the cart state of a signed-in shopper', () => {
    const details = productFixture('en');
    const me = meFixture('en');
    me.cartQuantities = { [String(details.product.id)]: 3 };
    renderView(details, { me });

    expect(screen.getByRole('button', { name: 'Update cart' })).toBeDisabled();
    expect(screen.getByTestId('product-quantity')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: 'In cart (3)' })).toHaveAttribute('href', '/en/cart');
  });

  it('speaks Arabic', () => {
    const details = productFixture('ar');
    renderView(details, { locale: 'ar' });

    expect(screen.getByRole('heading', { level: 1, name: details.product.name })).toBeVisible();
    expect(screen.getByTestId('product-price').textContent).toBe(details.product.price!.display);
    expect(screen.getByRole('navigation', { name: 'مسار التنقل' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'المواصفات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'أضف إلى السلة' })).toBeEnabled();
    expect(screen.getByRole('img', { name: 'التقييم ٤٫١ من ٥' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `${details.options[1].values[1].label}, غير متوفر` })).toHaveAttribute(
      'href',
      productHref('ar', details.options[1].values[1].target!.slug),
    );
  });
});
