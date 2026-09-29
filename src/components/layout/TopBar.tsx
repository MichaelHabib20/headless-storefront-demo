import type { Layout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Icon } from '../ui/Icon';
import { TargetLink } from '../ui/TargetLink';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './TopBar.module.css';

/** Utility row above the header: store message, hotline, magazine/blog, language. */
export function TopBar({ layout, locale }: { layout: Layout; locale: Locale }) {
  const t = translator(locale);
  const { topBar } = layout;

  return (
    <div className={styles.bar}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.message}>{topBar.message}</p>
        <ul className={styles.links}>
          {topBar.hotline && (
            <li>
              <a href={`tel:${topBar.hotline}`} className={styles.link}>
                <Icon name="phone" size={14} />
                <span>
                  {t('hotline')} {topBar.hotline}
                </span>
              </a>
            </li>
          )}
          {topBar.links.map((link) => (
            <li key={link.label}>
              <TargetLink target={link.target} locale={locale} className={styles.link}>
                {link.label}
              </TargetLink>
            </li>
          ))}
          <li>
            <LanguageSwitch locale={locale} className={styles.link} label={t('language')} ariaLabel={t('languageLabel')} />
          </li>
        </ul>
      </div>
    </div>
  );
}
