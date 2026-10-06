'use client';

import { useState, useTransition, type FormEvent } from 'react';
import type { Locale, Voucher, Vouchers } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Money } from '@/money';
import type { AddVoucherAction } from './types';
import styles from './Vouchers.module.css';

interface VouchersViewProps {
  locale: Locale;
  vouchers: Vouchers;
  addAction: AddVoucherAction;
}

/**
 * The vouchers as the backend wrote them: one tab per status it lists (with its label and count),
 * every voucher's texts as they come, and the add form when `canAdd`. Adding only sends the code:
 * the backend decides and answers the new list, or why not.
 */
export function VouchersView({ locale, vouchers: first, addAction }: VouchersViewProps) {
  const t = translator(locale);
  const [vouchers, setVouchers] = useState(first);
  const [tab, setTab] = useState(first.statuses[0]?.status ?? 'active');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = vouchers.items.filter((voucher) => voucher.status === tab);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      let answer;
      try {
        answer = await addAction(locale, code);
      } catch (cause) {
        console.error('add voucher failed', cause);
        answer = { ok: false as const, message: t('vouchersAddFailed') };
      }
      setResult({ ok: answer.ok, message: answer.message });
      if (answer.ok) {
        setVouchers(answer.vouchers);
        setTab('active');
        setCode('');
      }
    });
  }

  return (
    <div className={styles.stack}>
      {vouchers.hint && <p className={styles.muted}>{vouchers.hint}</p>}

      {vouchers.canAdd && (
        <form className={styles.add} onSubmit={add} aria-labelledby="vouchers-add-title" data-testid="voucher-add">
          <h2 id="vouchers-add-title" className={styles.heading}>
            {t('vouchersAddTitle')}
          </h2>
          <div className={styles.addRow}>
            <label className="visually-hidden" htmlFor="voucher-code">
              {t('vouchersCodeLabel')}
            </label>
            <input id="voucher-code" name="code" className={styles.input} value={code} maxLength={100} autoComplete="off" placeholder={t('vouchersCodeLabel')} onChange={(event) => setCode(event.target.value)} aria-invalid={result?.ok === false || undefined} aria-describedby={result ? 'voucher-add-result' : undefined} />
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? t('vouchersAdding') : t('vouchersAdd')}
            </button>
          </div>
          {result && (
            <p id="voucher-add-result" className={result.ok ? styles.success : styles.error} role={result.ok ? 'status' : 'alert'} data-testid="voucher-add-result">
              {result.message}
            </p>
          )}
        </form>
      )}

      <div className={styles.tabs} role="tablist" aria-label={t('vouchersTabs')}>
        {vouchers.statuses.map((status) => (
          <button
            key={status.status}
            type="button"
            role="tab"
            id={`vouchers-tab-${status.status}`}
            aria-selected={tab === status.status}
            aria-controls="vouchers-panel"
            className={styles.tab}
            data-testid="voucher-tab"
            onClick={() => setTab(status.status)}
          >
            {status.label} <span className={styles.count}>({status.count})</span>
          </button>
        ))}
      </div>

      <div id="vouchers-panel" role="tabpanel" aria-labelledby={`vouchers-tab-${tab}`}>
        {shown.length === 0 ? (
          <p className={styles.muted} data-testid="vouchers-empty">
            {t('vouchersEmpty')}
          </p>
        ) : (
          <ul className={styles.list} data-testid="vouchers">
            {shown.map((voucher) => (
              <VoucherCard key={voucher.id} voucher={voucher} locale={locale} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VoucherCard({ voucher, locale }: { voucher: Voucher; locale: Locale }) {
  const t = translator(locale);
  return (
    <li className={styles.card} data-testid="voucher" data-status={voucher.status}>
      <div className={styles.cardHead}>
        <p className={styles.benefit}>{voucher.benefit}</p>
        <span className={styles.badge}>{voucher.statusLabel}</span>
      </div>
      <p className={styles.code}>
        <span className={styles.label}>{t('vouchersCode')}</span> <strong data-testid="voucher-code">{voucher.code}</strong>
      </p>
      {voucher.minimumOrder && <p className={styles.muted}>{voucher.minimumOrder}</p>}
      {voucher.credit && (
        <p className={styles.muted} data-testid="voucher-credit">
          {t('vouchersRemaining')} <Money value={voucher.credit.remaining} /> {t('vouchersOf')} <Money value={voucher.credit.total} />
        </p>
      )}
      {voucher.detail && <p className={styles.muted}>{voucher.detail}</p>}
      {voucher.expiry && <p className={styles.expiry}>{voucher.expiry}</p>}
    </li>
  );
}
