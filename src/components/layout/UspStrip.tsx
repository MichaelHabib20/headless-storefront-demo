import type { Locale } from '@/sdk';
import { translator, type MessageKey } from '@/lib/i18n';
import { NavIcon } from './NavIcon';
import styles from './ShellBanners.module.css';

/**
 * Why shop here: the storefront's own content (no merchant data exists for it), in i18n so both
 * languages stay in step. Change the texts in src/lib/messages/shell.ts.
 */
const ITEMS: { icon: string; title: MessageKey; text: MessageKey }[] = [
  { icon: 'local_shipping', title: 'uspDeliveryTitle', text: 'uspDeliveryText' },
  { icon: 'verified', title: 'uspGenuineTitle', text: 'uspGenuineText' },
  { icon: 'payments', title: 'uspPaymentTitle', text: 'uspPaymentText' },
  { icon: 'support_agent', title: 'uspSupportTitle', text: 'uspSupportText' },
];

export function UspStrip({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <section className={styles.usp} aria-label={t('uspLabel')} data-testid="usp-strip">
      <ul className={`container ${styles.uspList}`}>
        {ITEMS.map((item) => (
          <li key={item.title} className={styles.uspItem}>
            <NavIcon icon={item.icon} size={28} />
            <div>
              <p className={styles.uspTitle}>{t(item.title)}</p>
              <p className={styles.uspText}>{t(item.text)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
