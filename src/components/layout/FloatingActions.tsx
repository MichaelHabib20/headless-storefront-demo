import type { Layout } from '@/sdk';
import { Icon } from '../ui/Icon';
import styles from './FloatingActions.module.css';

/** WhatsApp chat button, shown when the merchant enabled it. */
export function WhatsAppButton({ whatsapp, label }: { whatsapp: Layout['whatsapp']; label: string }) {
  if (!whatsapp) return null;
  return (
    <a href={whatsapp.url} target="_blank" rel="noopener noreferrer" className={styles.whatsapp} aria-label={label} data-testid="whatsapp">
      <Icon name="whatsapp" size={28} />
    </a>
  );
}
