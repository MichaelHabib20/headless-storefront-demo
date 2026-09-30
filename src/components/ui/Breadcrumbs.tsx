import type { Link as LinkValue, Locale } from '@/sdk';
import { TargetLink } from './TargetLink';
import styles from './Breadcrumbs.module.css';

interface BreadcrumbsProps {
  /** `breadcrumbs` from the API, in order. The last one is the current page. */
  items: LinkValue[];
  locale: Locale;
  /** Accessible name of the trail, from i18n. */
  label: string;
}

/** The trail the backend decided. Items without a target (and the current page) are plain text. */
export function Breadcrumbs({ items, locale, label }: BreadcrumbsProps) {
  if (!items.length) return null;
  return (
    <nav aria-label={label} className={styles.breadcrumbs}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={index} className={styles.item} aria-current={current ? 'page' : undefined}>
              {current ? <span>{item.label}</span> : <TargetLink target={item.target} locale={locale} className={styles.link}>{item.label}</TargetLink>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
