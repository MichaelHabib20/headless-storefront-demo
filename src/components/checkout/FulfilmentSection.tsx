import Link from 'next/link';
import type { Checkout, CheckoutSelections, Locale, PickupBranch } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Money } from '@/money';
import type { ChangeSelections } from './types';
import styles from './Checkout.module.css';

interface FulfilmentSectionProps {
  checkout: Checkout;
  /** The choices to draw as chosen: the checkout's echo, plus what the shopper just asked for. */
  shown: CheckoutSelections;
  /** `GET /pickup-branches`. */
  branches: PickupBranch[];
  /** The backend is computing: prices on screen would belong to the old choices, so none is shown. */
  pending: boolean;
  locale: Locale;
  onChange: ChangeSelections;
}

const isWebUrl = (url: string | null): url is string => Boolean(url && /^https?:\/\//i.test(url));

/**
 * How the order gets to the shopper: the backend's options (with its reason when one is not
 * available), the shopper's addresses or the pickup branches, and the delivery fee or text the
 * backend computed. Picking something only tells the backend; it answers with a new checkout.
 */
export function FulfilmentSection({ checkout, shown, branches, pending, locale, onChange }: FulfilmentSectionProps) {
  const t = translator(locale);
  const { options, addresses, delivery } = checkout.fulfilment;

  return (
    <section className={styles.section} aria-labelledby="checkout-fulfilment-title" data-testid="checkout-fulfilment">
      <div className={styles.sectionHead}>
        <h2 id="checkout-fulfilment-title" className={styles.sectionTitle}>
          {t('checkoutFulfilmentTitle')}
        </h2>
      </div>

      <div className={`${styles.options} ${styles.optionsRow}`} role="radiogroup" aria-labelledby="checkout-fulfilment-title">
        {options.map((option) => {
          const chosen = shown.fulfilment === option.type;
          const classes = [styles.option, chosen ? styles.optionChosen : '', option.available ? '' : styles.optionDisabled].filter(Boolean).join(' ');
          return (
            <label key={option.type} className={classes} data-testid={`fulfilment-${option.type}`}>
              <input type="radio" name="checkout-fulfilment" checked={chosen} disabled={!option.available} onChange={() => onChange({ fulfilment: option.type })} />
              <span className={styles.optionBody}>
                <span className={styles.optionLabel}>{option.label}</span>
                {option.reason && <span className={styles.optionHint}>{option.reason}</span>}
              </span>
            </label>
          );
        })}
      </div>

      {shown.fulfilment === 'delivery' && (
        <>
          <h3 id="checkout-address-title" className={styles.subTitle}>
            {t('checkoutAddressTitle')}
          </h3>
          {addresses.length ? (
            <div className={styles.options} role="radiogroup" aria-labelledby="checkout-address-title">
              {addresses.map((address) => {
                const chosen = shown.addressId === address.id;
                const classes = [styles.option, chosen ? styles.optionChosen : '', address.deliverable ? '' : styles.optionDisabled].filter(Boolean).join(' ');
                return (
                  <label key={address.id} className={classes} data-testid="checkout-address">
                    <input type="radio" name="checkout-address" checked={chosen} disabled={!address.deliverable} onChange={() => onChange({ addressId: address.id })} />
                    <span className={styles.optionBody}>
                      <span className={styles.optionLabel}>
                        <span>{address.formatted}</span>
                        {address.isDefault && <span className={styles.tag}>{t('checkoutAddressDefault')}</span>}
                      </span>
                      {!address.deliverable && <span className={styles.optionWarning}>{t('checkoutAddressNotDeliverable')}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className={styles.muted}>{t('checkoutAddressNone')}</p>
          )}
          {/* The address form lives on the addresses page; it sends the shopper back here. */}
          <Link href={`${routes.addresses(locale)}?next=checkout`} className={styles.addLink} data-testid="checkout-add-address">
            {t('checkoutAddressAdd')}
          </Link>
        </>
      )}

      {shown.fulfilment === 'pickup' && (
        <>
          <h3 id="checkout-branch-title" className={styles.subTitle}>
            {t('checkoutBranchTitle')}
          </h3>
          {branches.length ? (
            <div className={styles.options} role="radiogroup" aria-labelledby="checkout-branch-title">
              {branches.map((branch) => {
                const chosen = shown.branchId === branch.id;
                return (
                  <label key={branch.id} className={`${styles.option} ${chosen ? styles.optionChosen : ''}`} data-testid="checkout-branch">
                    <input type="radio" name="checkout-branch" checked={chosen} onChange={() => onChange({ branchId: branch.id })} />
                    <span className={styles.optionBody}>
                      <span className={styles.optionLabel}>{branch.name}</span>
                      {branch.address && <span className={styles.optionHint}>{branch.address}</span>}
                      {branch.phone && <span className={styles.optionHint}>{branch.phone}</span>}
                      {isWebUrl(branch.mapUrl) && (
                        <a href={branch.mapUrl} target="_blank" rel="noopener noreferrer" className={styles.optionHint}>
                          {t('checkoutBranchMap')}
                        </a>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className={styles.muted}>{t('checkoutBranchNone')}</p>
          )}
        </>
      )}

      {delivery && !pending && (
        <dl className={styles.deliveryRow} data-testid="checkout-delivery">
          <dt>{t('checkoutDeliveryFee')}</dt>
          {delivery.text !== null || !delivery.fee ? <dd>{delivery.text}</dd> : <Money value={delivery.fee} as="dd" />}
        </dl>
      )}
    </section>
  );
}
