import Link from 'next/link';
import type { Locale, LoyaltySummary } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import styles from './Loyalty.module.css';

export type LoyaltySection = 'points' | 'rewards' | 'history' | 'referral';

interface LoyaltyNavProps {
  locale: Locale;
  /** Which pages the store's provider has (`LoyaltySummary.sections`); null = points only. */
  sections: LoyaltySummary['sections'] | null;
  current: LoyaltySection;
}

/** Links between the loyalty pages the backend says exist. */
export function LoyaltyNav({ locale, sections, current }: LoyaltyNavProps) {
  const t = translator(locale);
  const links: { id: LoyaltySection; href: string; label: string }[] = [
    { id: 'points', href: routes.points(locale), label: t('loyaltyPointsTitle') },
    ...(sections?.rewards ? [{ id: 'rewards' as const, href: routes.rewards(locale), label: t('loyaltyRewardsTitle') }] : []),
    ...(sections?.history ? [{ id: 'history' as const, href: routes.pointsHistory(locale), label: t('loyaltyHistoryTitle') }] : []),
    ...(sections?.referral ? [{ id: 'referral' as const, href: routes.freePoints(locale), label: t('loyaltyReferralTitle') }] : []),
  ];
  if (links.length < 2) return null;
  return (
    <nav aria-label={t('loyaltyNav')} className={styles.nav} data-testid="loyalty-nav">
      <ul>
        {links.map((link) => (
          <li key={link.id}>
            <Link href={link.href} aria-current={link.id === current ? 'page' : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
