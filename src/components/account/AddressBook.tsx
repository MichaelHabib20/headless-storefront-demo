'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import type { Address, Locale } from '@/sdk';
import { translator, type MessageKey } from '@/lib/i18n';
import { routes, type AddressReturn } from '@/lib/routing';
import type { AddressBookAction, AddressBookResult } from './types';
import styles from './Account.module.css';

interface AddressBookProps {
  items: Address[];
  locale: Locale;
  /** `?next=` of the page: kept on the edit links so a save goes back there. */
  next: AddressReturn | null;
  /** The address just saved (`?saved=`, the id the API answered with): announced and outlined. */
  savedId: number | null;
  onDelete: AddressBookAction;
  onMakeDefault: AddressBookAction;
}

type Status = { tone: 'success' | 'error'; text: string };

/**
 * The shopper's saved addresses. Every change answers with the whole address book, which replaces
 * the list: which address is the default, its text and whether the store delivers there are the API's.
 */
export function AddressBook({ items: serverItems, locale, next, savedId, onDelete, onMakeDefault }: AddressBookProps) {
  const t = translator(locale);
  const [items, setItems] = useState(serverItems);
  // A fresh server render (e.g. after revalidation) is the newest answer from the API.
  const [lastServerItems, setLastServerItems] = useState(serverItems);
  if (serverItems !== lastServerItems) {
    setLastServerItems(serverItems);
    setItems(serverItems);
  }

  const saved = savedId !== null && items.some((address) => address.id === savedId) ? savedId : null;
  const savedStatus: Status | null = saved ? { tone: 'success', text: t('addressesSaved') } : null;
  const [status, setStatus] = useState(savedStatus);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLDivElement>(null);

  function run(addressId: number, action: AddressBookAction, success: MessageKey) {
    setStatus(null);
    startTransition(async () => {
      let result: AddressBookResult;
      try {
        result = await action(locale, addressId);
      } catch {
        result = { ok: false, message: t('addressesActionError') };
      }
      startTransition(() => {
        if (result.ok) setItems(result.items);
        setStatus(result.ok ? { tone: 'success', text: t(success) } : { tone: 'error', text: result.message });
      });
      // The button that was used may be gone (deleted card): keep keyboard users in place.
      statusRef.current?.focus();
    });
  }

  // Display order only: the default address first, the others as the API sent them.
  const ordered = [...items.filter((address) => address.isDefault), ...items.filter((address) => !address.isDefault)];

  return (
    <div aria-busy={pending || undefined}>
      <div ref={statusRef} tabIndex={-1} className={styles.status} aria-live="polite" data-testid="addresses-status">
        {status && (
          <p className={status.tone === 'error' ? styles.error : styles.success} role={status.tone === 'error' ? 'alert' : undefined}>
            {status.text}
          </p>
        )}
      </div>

      {ordered.length ? (
        <ul className={styles.addressGrid} aria-label={t('addressesList')} data-testid="addresses">
          {ordered.map((address) => (
            <li key={address.id}>
              <AddressCard
                address={address}
                locale={locale}
                next={next}
                highlighted={address.id === saved}
                disabled={pending}
                onDelete={() => run(address.id, onDelete, 'addressesDeleted')}
                onMakeDefault={() => run(address.id, onMakeDefault, 'addressesDefaultChanged')}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.state} data-testid="addresses-empty">
          <h2 className={styles.stateTitle}>{t('addressesEmptyTitle')}</h2>
          <p className={styles.stateText}>{t('addressesEmptyText')}</p>
        </div>
      )}
    </div>
  );
}

interface AddressCardProps {
  address: Address;
  locale: Locale;
  next: AddressReturn | null;
  highlighted: boolean;
  disabled: boolean;
  onDelete: () => void;
  onMakeDefault: () => void;
}

function AddressCard({ address, locale, next, highlighted, disabled, onDelete, onMakeDefault }: AddressCardProps) {
  const t = translator(locale);
  const textId = useId();
  const [confirming, setConfirming] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) keep.current?.focus();
  }, [confirming]);

  return (
    <article
      className={`${styles.addressCard} ${highlighted ? styles.saved : ''}`}
      data-testid="address"
      data-address-id={address.id}
      data-default={address.isDefault}
      aria-labelledby={textId}
    >
      {address.isDefault && <p className={styles.badge}>{t('addressesDefault')}</p>}
      <p id={textId} className={styles.formatted} data-testid="address-text">
        {address.formatted}
      </p>
      {!address.deliverable && (
        <p className={styles.warning} data-testid="address-not-deliverable">
          {t('addressesNotDeliverable')}
        </p>
      )}

      <div className={styles.cardActions}>
        {confirming ? (
          <div className={styles.confirm} role="group" aria-label={t('addressesDelete')}>
            <span className={styles.confirmText}>{t('addressesDeleteConfirm')}</span>
            <button
              type="button"
              className={styles.textButton}
              disabled={disabled}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              {t('addressesDeleteYes')}
            </button>
            <button ref={keep} type="button" className={styles.textButton} onClick={() => setConfirming(false)}>
              {t('addressesDeleteNo')}
            </button>
          </div>
        ) : (
          <>
            <Link href={routes.editAddress(locale, address.id, next)} aria-describedby={textId}>
              {t('addressesEdit')}
            </Link>
            {!address.isDefault && (
              <button type="button" className={styles.textButton} disabled={disabled} onClick={onMakeDefault} aria-describedby={textId}>
                {t('addressesMakeDefault')}
              </button>
            )}
            <button type="button" className={styles.textButton} disabled={disabled} onClick={() => setConfirming(true)} aria-describedby={textId}>
              {t('addressesDelete')}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
