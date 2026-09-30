import type { Checkout, CheckoutSelections, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Money } from '@/money';
import type { ChangeSelections } from './types';
import styles from './Checkout.module.css';

interface PaymentSectionProps {
  checkout: Checkout;
  /** The choices to draw as chosen: the checkout's echo, plus what the shopper just asked for. */
  shown: CheckoutSelections;
  /** The backend is computing: fees on screen would belong to the old choices, so none is shown. */
  pending: boolean;
  locale: Locale;
  onChange: ChangeSelections;
}

const isWebUrl = (url: string | null): url is string => Boolean(url && /^https?:\/\//i.test(url));

/**
 * The payment methods the backend offers for this cart and these choices, with its fee, its
 * note and its installment plans. Which methods exist, what they cost and whether a plan is
 * needed are the backend's; picking one only asks it to compute again.
 */
export function PaymentSection({ checkout, shown, pending, locale, onChange }: PaymentSectionProps) {
  const t = translator(locale);
  const { methods } = checkout.payment;

  return (
    <section className={styles.section} aria-labelledby="checkout-payment-title" data-testid="checkout-payment">
      <div className={styles.sectionHead}>
        <h2 id="checkout-payment-title" className={styles.sectionTitle}>
          {t('checkoutPaymentTitle')}
        </h2>
      </div>

      <div className={styles.options} role="radiogroup" aria-labelledby="checkout-payment-title">
        {methods.map((method) => {
          const chosen = shown.paymentMethodId === method.id;
          const plansId = `checkout-plans-${method.id}`;
          return (
            <div key={method.id} data-testid="payment-method" data-chosen={chosen || undefined}>
              <label className={`${styles.option} ${chosen ? styles.optionChosen : ''}`}>
                <input type="radio" name="checkout-payment" checked={chosen} onChange={() => onChange({ paymentMethodId: method.id, installmentPlanId: null })} />
                {/* eslint-disable-next-line @next/next/no-img-element -- icons come from the store's own CDN */}
                {isWebUrl(method.icon) && <img src={method.icon} alt="" className={styles.icon} loading="lazy" decoding="async" />}
                <span className={styles.optionBody}>
                  <span className={styles.optionLabel}>
                    <span>{method.name}</span>
                    {method.fee && !pending && (
                      <span className={styles.fee} data-testid="payment-fee">
                        {t('checkoutPaymentFee')} <Money value={method.fee} />
                      </span>
                    )}
                  </span>
                  {method.note && <span className={styles.optionHint}>{method.note}</span>}
                  {method.online && <span className={styles.optionHint}>{t('checkoutPaymentOnline')}</span>}
                </span>
              </label>

              {chosen && method.plans.length > 0 && (
                <div className={styles.nested}>
                  <h3 id={plansId} className={styles.subTitle}>
                    {t('checkoutPlanTitle')}
                  </h3>
                  <div className={styles.options} role="radiogroup" aria-labelledby={plansId}>
                    {method.plans.map((plan) => {
                      const planChosen = shown.installmentPlanId === plan.id;
                      return (
                        <label key={plan.id} className={`${styles.option} ${planChosen ? styles.optionChosen : ''}`} data-testid="payment-plan">
                          <input type="radio" name={plansId} checked={planChosen} onChange={() => onChange({ paymentMethodId: method.id, installmentPlanId: plan.id })} />
                          <span className={styles.optionLabel}>{plan.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
