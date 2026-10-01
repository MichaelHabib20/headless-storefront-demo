'use client';

import { useState } from 'react';
import type { AppBanner as AppBannerData } from '@/sdk';
import { APP_BANNER_COOKIE, DISMISS_DAYS, rememberDismissal } from '@/lib/shell';
import { Icon } from '../ui/Icon';
import styles from './ShellBanners.module.css';

interface AppBannerProps {
  banner: AppBannerData;
  labels: { region: string; dismiss: string; android: string; ios: string; huawei: string };
}

/** "Download our app" (`Layout.appBanner`): the merchant's texts and store links. Dismissed with a cookie. */
export function AppBanner({ banner, labels }: AppBannerProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  const links = banner.links ? (Object.entries(banner.links) as [keyof NonNullable<AppBannerData['links']>, string][]) : [];
  if (!links.length) return null;

  return (
    <aside className={styles.app} aria-label={banner.title ?? labels.region} data-testid="app-banner">
      <div className={`container ${styles.appInner}`}>
        <div className={styles.appText}>
          {banner.title && <p className={styles.appTitle}>{banner.title}</p>}
          {banner.text && <p className={styles.appBody}>{banner.text}</p>}
        </div>
        <ul className={styles.appLinks}>
          {links.map(([platform, url]) => (
            <li key={platform}>
              <a href={url} target="_blank" rel="noopener noreferrer" className={styles.appLink}>
                {labels[platform]}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={styles.dismiss}
          aria-label={labels.dismiss}
          onClick={() => {
            rememberDismissal(APP_BANNER_COOKIE, 'dismissed', DISMISS_DAYS.appBanner);
            setVisible(false);
          }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    </aside>
  );
}
