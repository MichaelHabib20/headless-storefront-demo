import type { Checkout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Icon } from '../ui/Icon';
import styles from './Checkout.module.css';

interface PlaceOrderProps {
  /** The checkout on screen. Its `canPlaceOrder` is the backend's switch for the button. */
  checkout: Checkout;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  /** A change is being computed: the totals next to the button are not on screen yet. */
  pending: boolean;
  /** The order is on its way to the backend (or the browser is leaving for the next page). */
  placing: boolean;
  /** The backend changed the payment method: this click accepts it. */
  consent: boolean;
  onPlace: () => void;
  locale: Locale;
  /** Id of the element that explains why the button is disabled (missing / blockers). */
  describedBy?: string;
}

/**
 * The terms checkbox and the place-order button. The button is enabled by the backend's
 * `canPlaceOrder`, and only while the shopper has ticked the terms and the checkout on screen
 * is the latest answer. Nothing else may enable it: what is missing, minimum orders, stock and
 * payment rules are already inside `canPlaceOrder`.
 */
export function PlaceOrder({ checkout, termsAccepted, onTermsChange, pending, placing, consent, onPlace, locale, describedBy }: PlaceOrderProps) {
  const t = translator(locale);
  const enabled = checkout.canPlaceOrder && termsAccepted && !pending && !placing;

  return (
    <>
      <label className={styles.terms}>
        <input type="checkbox" checked={termsAccepted} disabled={placing} onChange={(event) => onTermsChange(event.target.checked)} data-testid="checkout-terms" />
        <span>{t('checkoutTerms')}</span>
      </label>
      <button type="button" className={styles.place} disabled={!enabled} aria-busy={placing || undefined} aria-describedby={describedBy} onClick={onPlace} data-testid="place-order">
        {placing ? t('checkoutPlacing') : consent ? t('checkoutAcceptChange') : t('checkoutPlace')}
        <Icon name="arrow" size={20} directional />
      </button>
    </>
  );
}
