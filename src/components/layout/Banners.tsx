'use client';

import { useState } from 'react';
import type { Banner, Locale } from '@/sdk';
import { DISMISS_DAYS, FLOATING_BANNER_COOKIE, rememberDismissal } from '@/lib/shell';
import { Icon } from '../ui/Icon';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { TargetLink } from '../ui/TargetLink';
import styles from './ShellBanners.module.css';

/** The merchant's ad above the header on every page (`Layout.topBanner`). */
export function TopBanner({ banner, locale, label }: { banner: Banner; locale: Locale; label: string }) {
  return (
    <aside className={styles.top} aria-label={banner.title ?? label} data-testid="top-banner">
      <TargetLink target={banner.target} locale={locale} className={styles.topLink}>
        <ResponsiveImage image={banner.image} className={styles.topImage} fallbackAlt={banner.title ?? label} />
      </TargetLink>
    </aside>
  );
}

/** The merchant's ad floating over the page (`Layout.floatingBanner`); closing it hides this ad for a day. */
export function FloatingBanner({ banner, locale, labels }: { banner: Banner; locale: Locale; labels: { region: string; dismiss: string } }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <aside className={styles.floating} aria-label={banner.title ?? labels.region} data-testid="floating-banner">
      <TargetLink target={banner.target} locale={locale} className={styles.floatingLink}>
        <ResponsiveImage image={banner.image} className={styles.floatingImage} fallbackAlt={banner.title ?? labels.region} />
      </TargetLink>
      <button
        type="button"
        className={styles.floatingClose}
        aria-label={labels.dismiss}
        onClick={() => {
          rememberDismissal(FLOATING_BANNER_COOKIE, String(banner.id), DISMISS_DAYS.floatingBanner);
          setVisible(false);
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </aside>
  );
}
