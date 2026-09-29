import type { Locale, Target } from '@/sdk';
import { TargetLink } from './TargetLink';
import styles from './SectionHeading.module.css';

interface SectionHeadingProps {
  title: string | null;
  locale: Locale;
  viewAll?: Target | null;
  viewAllLabel: string;
  id?: string;
  /** Optional short line under the title */
  subtitle?: string;
}

export function SectionHeading({ title, locale, viewAll, viewAllLabel, id, subtitle }: SectionHeadingProps) {
  if (!title && !viewAll) return null;
  return (
    <div className={styles.heading}>
      {title ? (
        <div className={styles.titles}>
          <h2 id={id} className={styles.title}>
            {title}
          </h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      ) : (
        <span />
      )}
      {viewAll && (
        <TargetLink target={viewAll} locale={locale} className={styles.viewAll}>
          {viewAllLabel}
        </TargetLink>
      )}
    </div>
  );
}
