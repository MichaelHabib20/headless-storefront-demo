import Link from 'next/link';
import type { Locale, Wallet } from '@/sdk';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/dates';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Money } from '@/money';
import styles from './Wallet.module.css';

/**
 * The wallet as the backend wrote it: the balance, a hint about using it, and the history newest
 * first. Signs, titles and amounts are the backend's; `credit` only picks a style.
 */
export function WalletView({ locale, wallet, timeZone }: { locale: Locale; wallet: Wallet; timeZone?: string }) {
  const t = translator(locale);
  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="wallet-balance" data-testid="wallet-balance">
        <p id="wallet-balance" className={styles.label}>
          {t('walletBalance')}
        </p>
        <Money value={wallet.balance} as="p" className={styles.balance} />
        {wallet.hint && <p className={styles.muted}>{wallet.hint}</p>}
      </section>

      <section aria-labelledby="wallet-history-title">
        <h2 id="wallet-history-title" className={styles.heading}>
          {t('walletHistoryTitle')}
        </h2>
        {wallet.items.length === 0 ? (
          <p className={styles.muted} data-testid="wallet-empty">
            {t('walletEmpty')}
          </p>
        ) : (
          <>
            <ul className={styles.history} data-testid="wallet-history">
              {wallet.items.map((entry) => (
                <li key={entry.id} className={styles.entry} data-testid="wallet-entry" data-kind={entry.kind}>
                  <div>
                    <p className={styles.entryTitle}>{entry.title}</p>
                    <time dateTime={entry.date} className={styles.muted}>
                      {formatDate(entry.date, locale, { timeZone })}
                    </time>
                    {entry.orderId && (
                      <Link href={routes.order(locale, entry.orderId)} className={styles.link}>
                        {t('walletViewOrder')}
                      </Link>
                    )}
                  </div>
                  <span className={styles.amount} data-credit={entry.credit}>
                    <Money value={entry.amount} as="strong" data-testid="wallet-entry-amount" />
                  </span>
                </li>
              ))}
            </ul>
            <Pagination
              pagination={wallet.pagination}
              baseHref={routes.wallet(locale)}
              hrefFor={(n) => routes.wallet(locale, n)}
              locale={locale}
              labels={{ nav: t('walletPages'), previous: t('previous'), next: t('next'), page: t('ordersPage') }}
            />
          </>
        )}
      </section>
    </div>
  );
}
