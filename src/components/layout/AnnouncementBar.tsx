import type { Layout } from '@/sdk';
import styles from './AnnouncementBar.module.css';

/** The store's softbar message. Hidden when the merchant switches it off. */
export function AnnouncementBar({ announcement }: { announcement: Layout['announcement'] }) {
  if (!announcement) return null;
  return (
    <div className={styles.bar} role="region" aria-label={announcement.text} data-testid="announcement">
      {announcement.icon && (
        // eslint-disable-next-line @next/next/no-img-element -- merchant icon from any CDN
        <img src={announcement.icon} alt="" width={18} height={18} className={styles.icon} />
      )}
      <p className={styles.text}>{announcement.text}</p>
    </div>
  );
}
