'use client';

import { useState, type FormEvent } from 'react';
import type { Checkout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import styles from './Checkout.module.css';

/** A code the backend refused, with its message (the code itself is no longer applied). */
export interface PromoRefusal {
  code: string;
  message: string | null;
}

interface PromoSectionProps {
  /** `checkout.promo`: the code the backend used, whether it applied, and its message. */
  promo: Checkout['promo'];
  /** The last code the backend refused; the checkout was computed again without it. */
  refusal?: PromoRefusal | null;
  locale: Locale;
  busy: boolean;
  /** Sends a code (or null to remove it); the checkout decides whether it applies. */
  onApply: (code: string | null) => void;
}

const MESSAGE_ID = 'checkout-promo-message';

/**
 * Promo code field. The storefront never judges a code: it sends it, and shows the backend's
 * `promo.message` (why it was refused, or what it changed). The discount itself is a line of
 * the totals. A refused code is not kept (see `CheckoutView`): its message stays under the field,
 * with the typed code, so the shopper can correct it.
 */
export function PromoSection({ promo, refusal = null, locale, busy, onApply }: PromoSectionProps) {
  const t = translator(locale);
  const [code, setCode] = useState('');

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    onApply(value);
  }

  const refused = !promo.code && refusal ? refusal : null;
  const message = promo.message ?? refused?.message ?? null;

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
          <button type="button" className={styles.textLink} disabled={busy} onClick={() => onApply(null)}>
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
            aria-invalid={refused ? true : undefined}
            aria-describedby={refused && message ? MESSAGE_ID : undefined}
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="submit" className={`${styles.button} ${styles.buttonQuiet}`} disabled={busy}>
            {t('checkoutPromoApply')}
          </button>
        </form>
      )}

      {message && (
        <p
          id={MESSAGE_ID}
          className={styles.promoMessage}
          role={refused ? 'alert' : 'status'}
          data-applied={refused ? false : promo.applied}
          data-testid="promo-message"
        >
          {message}
        </p>
      )}

      {/* phase B: the customer's active vouchers, as the backend lists them; a tap sends the code like a typed one */}
      {promo.suggestions && promo.suggestions.length > 0 && (
        <div className={styles.suggestions} data-testid="promo-suggestions">
          <p className={styles.subTitle}>{t('checkoutVoucherSuggestions')}</p>
          <ul>
            {promo.suggestions.map((suggestion) => (
              <li key={suggestion.code}>
                <button type="button" className={styles.suggestion} disabled={busy} onClick={() => onApply(suggestion.code)} data-testid="promo-suggestion">
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
