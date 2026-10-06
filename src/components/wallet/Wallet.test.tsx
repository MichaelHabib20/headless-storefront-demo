/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { checkoutSelections, type Checkout } from '@/sdk';
import { checkoutSettingsFixture, pickupBranchesFixture } from '@/test/checkout-fixtures';
import { emptyWalletFixture, walletAllCheckoutFixture, walletFixture, walletPartCheckoutFixture } from '@/test/wallet-fixtures';
import { CheckoutView } from '@/components/checkout/CheckoutView';
import type { ComputeCheckoutAction, PlaceOrderAction, SaveContactAction, UploadPrescriptionAction } from '@/components/checkout/types';
import { WalletView } from './WalletView';

describe('wallet page (as the backend wrote it)', () => {
  it('balance, hint and history newest first, with the order link only where the backend gives one (EN + AR)', () => {
    const wallet = walletFixture('en');
    const { unmount } = render(<WalletView locale="en" wallet={wallet} timeZone="Africa/Cairo" />);
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent(wallet.balance.display);
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent(wallet.hint!);
    const entries = screen.getAllByTestId('wallet-entry');
    expect(entries.map((entry) => entry.getAttribute('data-kind'))).toEqual(['payment', 'deposit']);
    expect(within(entries[0]).getByTestId('wallet-entry-amount').textContent).toBe(wallet.items[0].amount.display);
    expect(within(entries[0]).getByRole('link', { name: 'View order' })).toHaveAttribute('href', `/en/account/orders/${wallet.items[0].orderId}`);
    expect(within(entries[1]).queryByRole('link')).toBeNull();
    unmount();

    render(<WalletView locale="ar" wallet={walletFixture('ar')} timeZone="Africa/Cairo" />);
    expect(screen.getByText('الرصيد')).toBeInTheDocument();
    expect(screen.getAllByTestId('wallet-entry')[0]).toHaveTextContent('دفع للطلب رقم 48200');
  });

  it('an empty wallet', () => {
    render(<WalletView locale="en" wallet={emptyWalletFixture('en')} />);
    expect(screen.getByTestId('wallet-empty')).toHaveTextContent('No wallet activity yet.');
    expect(screen.queryByTestId('wallet-history')).toBeNull();
  });
});

function checkoutView(checkout: Checkout) {
  const actions = {
    computeAction: vi.fn<ComputeCheckoutAction>(),
    saveContactAction: vi.fn<SaveContactAction>(),
    uploadAction: vi.fn<UploadPrescriptionAction>(),
    placeAction: vi.fn<PlaceOrderAction>(),
  };
  render(
    <CheckoutView checkout={checkout} settings={checkoutSettingsFixture({})} branches={pickupBranchesFixture('en')} locale="en" attemptKey="k1" navigate={vi.fn()} {...actions} />,
  );
  return { ...actions, user: userEvent.setup() };
}

describe('checkout: paying with the wallet', () => {
  it('draws the switch, the backend message and the wallet line; the rest still needs a method', () => {
    const checkout = walletPartCheckoutFixture('en');
    checkoutView(checkout);

    expect(screen.getByTestId('use-wallet')).toBeChecked();
    expect(screen.getByTestId('checkout-wallet')).toHaveTextContent(checkout.wallet!.label);
    expect(screen.getByTestId('wallet-balance').textContent).toBe(checkout.wallet!.balance.display);
    expect(screen.getByTestId('wallet-message')).toHaveTextContent(checkout.wallet!.message!);
    expect(screen.getAllByTestId('payment-method').length).toBe(checkout.payment.methods.length);
    const walletLine = screen.getAllByTestId('checkout-total-line').find((line) => line.getAttribute('data-kind') === 'wallet');
    expect(walletLine).toHaveTextContent(checkout.totals.lines.at(-1)!.amount!.display);
    expect(screen.getByTestId('checkout-total').textContent).toBe(checkout.totals.total.display);
  });

  it('when the wallet pays everything no payment method is shown', () => {
    checkoutView(walletAllCheckoutFixture('en'));
    expect(screen.queryByTestId('checkout-payment')).toBeNull();
    expect(screen.getByTestId('wallet-message')).toHaveTextContent('Your wallet pays for the whole order.');
  });

  it('turning it off only asks the backend again, with the other choices of the answer on screen', async () => {
    const checkout = walletPartCheckoutFixture('en');
    const { computeAction, user } = checkoutView(checkout);
    const off = structuredClone(checkout);
    off.wallet = { ...off.wallet!, selected: false, amount: null, message: null };
    computeAction.mockResolvedValue({ ok: true, checkout: off });

    await user.click(screen.getByTestId('use-wallet'));

    await waitFor(() => expect(screen.getByTestId('use-wallet')).not.toBeChecked());
    expect(computeAction).toHaveBeenCalledWith('en', { ...checkoutSelections(checkout), note: null, useWallet: false });
    expect(checkoutSelections(checkout).useWallet).toBe(true);
  });
});
