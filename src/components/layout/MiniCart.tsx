'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Cart, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import type { MiniCartResult } from '@/lib/shell.actions';
import { Money } from '@/money';
import { CheckoutBlockers } from '../cart/CheckoutBlockers';
import { formatQuantity } from '../cart/quantity';
import { Icon } from '../ui/Icon';
import styles from './MiniCart.module.css';

type ReadCart = (locale: Locale) => Promise<MiniCartResult>;

interface MiniCartValue {
  /** Opens the drawer and reads the cart again (after an add to cart). */
  open: () => void;
}

// Without a provider (tests, pages outside the layout) opening does nothing.
const MiniCartContext = createContext<MiniCartValue>({ open: () => undefined });

export function useMiniCart(): MiniCartValue {
  return useContext(MiniCartContext);
}

type View = { status: 'closed' } | { status: 'loading' } | MiniCartResult;

/**
 * The mini cart drawer. Product buttons open it after a successful add to cart; it then reads
 * `GET /cart` through a server action and shows the API's answer as it is: lines, totals, the
 * blockers and a checkout button enabled only by `checkout.allowed`. Nothing is computed here.
 */
export function MiniCartProvider({ locale, readCart, children }: { locale: Locale; readCart: ReadCart; children: ReactNode }) {
  const [view, setView] = useState<View>({ status: 'closed' });
  const request = useRef(0);

  const open = useCallback(() => {
    const id = ++request.current;
    setView({ status: 'loading' });
    readCart(locale)
      .catch((): MiniCartResult => ({ status: 'error' }))
      .then((result) => {
        if (request.current === id) setView(result);
      });
  }, [locale, readCart]);
  const close = useCallback(() => {
    request.current++;
    setView({ status: 'closed' });
  }, []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <MiniCartContext.Provider value={value}>
      {children}
      {view.status !== 'closed' && <MiniCartDrawer locale={locale} view={view} onClose={close} />}
    </MiniCartContext.Provider>
  );
}

function MiniCartDrawer({ locale, view, onClose }: { locale: Locale; view: Exclude<View, { status: 'closed' }>; onClose: () => void }) {
  const t = translator(locale);
  const panel = useRef<HTMLDivElement>(null);

  // Focus the drawer and let Escape close it (keyboard users).
  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panel} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="mini-cart-title" tabIndex={-1} data-testid="mini-cart">
        <div className={styles.head}>
          <h2 id="mini-cart-title" className={styles.title}>
            {t('miniCartTitle')}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('miniCartClose')}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {view.status === 'loading' && (
          <p className={styles.note} role="status">
            {t('miniCartLoading')}
          </p>
        )}
        {view.status === 'error' && (
          <p className={styles.note} role="alert">
            {t('miniCartError')}
          </p>
        )}
        {(view.status === 'none' || (view.status === 'ok' && view.cart.items.length === 0)) && <p className={styles.note}>{t('miniCartEmpty')}</p>}
        {view.status === 'ok' && view.cart.items.length > 0 && <MiniCartBody cart={view.cart} locale={locale} onNavigate={onClose} />}
      </div>
    </div>
  );
}

function MiniCartBody({ cart, locale, onNavigate }: { cart: Cart; locale: Locale; onNavigate: () => void }) {
  const t = translator(locale);
  const { summary, checkout } = cart;
  return (
    <>
      <ul className={styles.lines} aria-label={t('miniCartItems')}>
        {cart.items.map((item) => (
          <li key={item.product.id} className={styles.line} data-testid="mini-cart-line">
            {item.product.image && (
              // eslint-disable-next-line @next/next/no-img-element -- product image from any CDN
              <img src={item.product.image.url} alt={item.product.image.alt ?? ''} className={styles.image} />
            )}
            <div className={styles.lineText}>
              <p className={styles.name}>{item.product.name}</p>
              <p className={styles.quantity}>{t('miniCartQuantity').replace('{count}', formatQuantity(item.quantity, locale))}</p>
              {item.availability.message && <p className={styles.warning}>{item.availability.message}</p>}
            </div>
            <Money value={item.lineTotal} className={styles.lineTotal} />
          </li>
        ))}
      </ul>
      <dl className={styles.summary}>
        <div className={styles.row}>
          <dt>{t('cartSubtotal')}</dt>
          <Money value={summary.subtotal} as="dd" />
        </div>
        {summary.discount && (
          <div className={styles.row}>
            <dt>{t('cartDiscount')}</dt>
            <Money value={summary.discount} as="dd" />
          </div>
        )}
        <div className={`${styles.row} ${styles.total}`}>
          <dt>{t('cartTotal')}</dt>
          <Money value={summary.total} as="dd" data-testid="mini-cart-total" />
        </div>
      </dl>
      <CheckoutBlockers blockers={checkout.blockers} locale={locale} id="mini-cart-blockers" />
      <div className={styles.actions}>
        <Link href={routes.cart(locale)} className={styles.secondary} onClick={onNavigate}>
          {t('miniCartViewCart')}
        </Link>
        {checkout.allowed ? (
          <Link href={routes.checkout(locale)} className={styles.primary} onClick={onNavigate} data-testid="mini-cart-checkout">
            {t('miniCartCheckout')}
          </Link>
        ) : (
          <button type="button" className={styles.primary} disabled aria-describedby={checkout.blockers.length ? 'mini-cart-blockers' : undefined} data-testid="mini-cart-checkout">
            {t('miniCartCheckout')}
          </button>
        )}
      </div>
    </>
  );
}
