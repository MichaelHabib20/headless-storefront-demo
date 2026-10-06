'use client';

import { useState, type FormEvent } from 'react';
import type { Checkout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import type { ChangeSelections } from './types';
import styles from './Checkout.module.css';

interface PromoSectionProps {
  /** `checkout.promo`: the code the backend used, whether it applied, and its message. */
  promo: Checkout['promo'];
  locale: Locale;
  busy: boolean;
  onChange: ChangeSelections;
}

/**
 * Promo code field. The storefront never judges a code: it sends it, and shows the backend's
 * `promo.message` (why it was refused, or what it changed). The discount itself is a line of
 * the totals.
 */
export function PromoSection({ promo, locale, busy, onChange }: PromoSectionProps) {
  const t = translator(locale);
  const [code, setCode] = useState('');

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    onChange({ promoCode: value });
    setCode('');
  }

  return (
    <section className={styles.section} aria-labelledby="checkout-promo-title" data-testid="checkout-promo">
      <div className={styles.sectionHead}>
        <h2 id="checkout-promo-title" className={styles.sectionTitle}>
          {t('checkoutPromoTitle')}
        </h2>
      </div>

      {promo.code ? (
        <div className={styles.promoApplied}>
          <span className={styles.promoCode} data-testid="promo-code">
            {promo.code}
          </span>
          <button type="button" className={styles.textLink} disabled={busy} onClick={() => onChange({ promoCode: null })}>
            {t('checkoutPromoRemove')}
          </button>
        </div>
      ) : (
        <form className={styles.promoForm} onSubmit={apply}>
          <input
            className={styles.input}
            name="promoCode"
            value={code}
            maxLength={100}
            autoComplete="off"
            aria-labelledby="checkout-promo-title"
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="submit" className={`${styles.button} ${styles.buttonQuiet}`} disabled={busy}>
            {t('checkoutPromoApply')}
          </button>
        </form>
      )}

      {promo.message && (
        <p className={styles.promoMessage} role="status" data-applied={promo.applied} data-testid="promo-message">
          {promo.message}
        </p>
      )}

      {/* phase B: the customer's active vouchers, as the backend lists them; a tap sends the code like a typed one */}
      {promo.suggestions && promo.suggestions.length > 0 && (
        <div className={styles.suggestions} data-testid="promo-suggestions">
          <p className={styles.subTitle}>{t('checkoutVoucherSuggestions')}</p>
          <ul>
            {promo.suggestions.map((suggestion) => (
              <li key={suggestion.code}>
                <button type="button" className={styles.suggestion} disabled={busy} onClick={() => onChange({ promoCode: suggestion.code })} data-testid="promo-suggestion">
                  <strong>{suggestion.code}</strong> <span>{suggestion.benefit}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
