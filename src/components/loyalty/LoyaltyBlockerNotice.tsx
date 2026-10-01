import Link from 'next/link';
import type { Locale, LoyaltyBlocker } from '@/sdk';
import { translator } from '@/lib/i18n';
import { loyaltyStepHref } from '@/lib/routing';
import styles from './Loyalty.module.css';

/** What the customer must do before redeeming (the backend's text) and the page that does it. */
export function LoyaltyBlockerNotice({ locale, blocker }: { locale: Locale; blocker: LoyaltyBlocker | null }) {
  if (!blocker) return null;
  const t = translator(locale);
  const href = loyaltyStepHref(locale, blocker.code);
  return (
    <div className={styles.notice} role="status" data-testid="loyalty-blocker" data-code={blocker.code}>
      <p>{blocker.message}</p>
      {href && <Link href={href}>{blocker.code === 'verify_phone' ? t('loyaltyVerifyPhoneLink') : t('loyaltyAddPhoneLink')}</Link>}
    </div>
  );
}
