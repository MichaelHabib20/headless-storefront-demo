import type { OrderStatus } from '@/sdk';
import { statusTone } from './status';
import styles from './Account.module.css';

/** The order status as the API wrote it (`label`); `code` only picks the look. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = statusTone(status.code);
  return (
    <span className={`${styles.statusBadge} ${styles[`tone-${tone}`] ?? ''}`} data-testid="order-status" data-status={status.code} data-tone={tone}>
      {status.label}
    </span>
  );
}
