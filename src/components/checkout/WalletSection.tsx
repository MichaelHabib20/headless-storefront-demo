import type { CheckoutSelections, CheckoutWallet, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Money } from '@/money';
import type { ChangeSelections } from './types';
import styles from './Checkout.module.css';

interface WalletSectionProps {
  /** `checkout.wallet`: the label, the balance, and what the wallet pays for these choices. */
  wallet: CheckoutWallet;
  /** The choices to draw as chosen: the checkout's echo, plus what the shopper just asked for. */
  shown: CheckoutSelections;
  /** The backend is computing: the amount on screen would belong to the old choices, so none is shown. */
  pending: boolean;
  locale: Locale;
  onChange: ChangeSelections;
}

/**
 * Pay with the wallet balance. The storefront only asks (`useWallet`): how much the wallet pays,
 * whether it pays everything and the texts are the backend's. The amount is also a line of the totals.
 */
export function WalletSection({ wallet, shown, pending, locale, onChange }: WalletSectionProps) {
  const t = translator(locale);
  const chosen = Boolean(shown.useWallet);
  return (
    <section className={styles.section} aria-labelledby="checkout-wallet-title" data-testid="checkout-wallet">
      <div className={styles.sectionHead}>
        <h2 id="checkout-wallet-title" className={styles.sectionTitle}>
          {t('walletTitle')}
        </h2>
      </div>
      <label className={`${styles.option} ${chosen ? styles.optionChosen : ''}`}>
        <input type="checkbox" name="useWallet" checked={chosen} onChange={() => onChange({ useWallet: !chosen })} data-testid="use-wallet" />
        <span className={styles.optionBody}>
          <span className={styles.optionLabel}>
            <span>{wallet.label}</span>
            <span className={styles.fee}>
              {t('walletBalance')} <Money value={wallet.balance} data-testid="wallet-balance" />
            </span>
          </span>
          {wallet.message && !pending && (
            <span className={styles.optionHint} role="status" data-testid="wallet-message">
              {wallet.message}
            </span>
          )}
        </span>
      </label>
    </section>
  );
}
