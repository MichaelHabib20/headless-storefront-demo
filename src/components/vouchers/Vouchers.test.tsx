/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { checkoutSelections } from '@/sdk';
import { PromoSection } from '@/components/checkout/PromoSection';
import { voucherAddedFixture, voucherSuggestionsCheckoutFixture, vouchersFixture } from '@/test/vouchers-fixtures';
import type { AddVoucherAction } from './types';
import { VouchersView } from './VouchersView';

describe('vouchers page (as the backend wrote it)', () => {
  it('tabs with the backend labels and counts; each voucher in its one status (EN + AR)', async () => {
    const vouchers = vouchersFixture('en');
    const user = userEvent.setup();
    const { unmount } = render(<VouchersView locale="en" vouchers={vouchers} addAction={vi.fn<AddVoucherAction>()} />);

    expect(screen.getAllByTestId('voucher-tab').map((tab) => tab.textContent)).toEqual(['Active (2)', 'Used (1)', 'Expired (1)']);
    const active = screen.getAllByTestId('voucher');
    expect(active.map((card) => within(card).getByTestId('voucher-code').textContent)).toEqual(['FREEDEL', 'SAVE10']);
    expect(active[0]).toHaveTextContent('On orders from 200 EGP');
    expect(within(active[0]).getByTestId('voucher-credit')).toHaveTextContent(vouchers.items[0].credit!.remaining.display);
    expect(active[0]).toHaveTextContent(vouchers.items[0].expiry!);

    await user.click(screen.getByRole('tab', { name: /Expired/ }));
    expect(screen.getAllByTestId('voucher').map((card) => card.getAttribute('data-status'))).toEqual(['expired']);
    unmount();

    render(<VouchersView locale="ar" vouchers={vouchersFixture('ar')} addAction={vi.fn<AddVoucherAction>()} />);
    expect(screen.getAllByTestId('voucher-tab')[0]).toHaveTextContent('نشطة');
  });

  it('adding a code shows the backend answer: the new list, or its reason', async () => {
    const user = userEvent.setup();
    const addAction = vi.fn<AddVoucherAction>().mockResolvedValueOnce({ ok: false, message: 'This voucher code is not valid.' });
    render(<VouchersView locale="en" vouchers={vouchersFixture('en')} addAction={addAction} />);

    await user.type(screen.getByRole('textbox', { name: 'Voucher code' }), 'NOPE');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByTestId('voucher-add-result')).toHaveTextContent('This voucher code is not valid.'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(addAction).toHaveBeenCalledWith('en', 'NOPE');

    const added = voucherAddedFixture('en');
    addAction.mockResolvedValueOnce({ ok: true, message: added.message, vouchers: added.vouchers });
    await user.clear(screen.getByRole('textbox', { name: 'Voucher code' }));
    await user.type(screen.getByRole('textbox', { name: 'Voucher code' }), 'WELCOME20');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByTestId('voucher-add-result')).toHaveTextContent(added.message));
    expect(screen.getAllByTestId('voucher-code').map((code) => code.textContent)).toContain('WELCOME20');
    expect(screen.getByRole('textbox', { name: 'Voucher code' })).toHaveValue('');
  });
});

describe('checkout: the customer vouchers as codes', () => {
  it('draws the backend suggestions; a tap sends the code like a typed one', async () => {
    const checkout = voucherSuggestionsCheckoutFixture('en');
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PromoSection promo={checkout.promo} locale="en" busy={false} onChange={onChange} />);

    const suggestions = screen.getAllByTestId('promo-suggestion');
    expect(suggestions.map((s) => s.textContent)).toEqual(checkout.promo.suggestions!.map((s) => `${s.code} ${s.benefit}`));
    await user.click(suggestions[1]);
    expect(onChange).toHaveBeenCalledWith({ promoCode: 'SAVE10' });
    // the suggestions are not choices: the echo has no trace of them
    expect(Object.keys(checkoutSelections(checkout))).not.toContain('suggestions');
  });

  it('no suggestions → nothing drawn', () => {
    const checkout = voucherSuggestionsCheckoutFixture('en');
    delete checkout.promo.suggestions;
    render(<PromoSection promo={checkout.promo} locale="en" busy={false} onChange={vi.fn()} />);
    expect(screen.queryByTestId('promo-suggestions')).toBeNull();
  });
});
