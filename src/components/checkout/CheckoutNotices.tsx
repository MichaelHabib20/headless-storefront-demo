import type { CheckoutMessage, CheckoutNotice } from '@/sdk';
import styles from './Checkout.module.css';

interface NoticeListProps {
  /** `missing` or `blockers` of a checkout. */
  notices: CheckoutNotice[];
  kind: 'missing' | 'blockers';
  title: string;
  id?: string;
}

/**
 * What the shopper still has to do (`missing`) or why the order can't be placed (`blockers`),
 * in the backend's words. `code` is only a hook for styling and tests: the text is never ours.
 * Renders nothing when the list is empty.
 */
export function NoticeList({ notices, kind, title, id }: NoticeListProps) {
  if (!notices.length) return null;
  return (
    <div id={id} className={styles.notices} data-kind={kind} data-testid={`checkout-${kind}`}>
      <p className={styles.noticesTitle}>{title}</p>
      <ul className={styles.noticeList}>
        {notices.map((notice, index) => (
          <li key={`${notice.code}-${index}`} data-code={notice.code}>
            {notice.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Things the backend changed and the shopper should know (a dropped choice, a changed price). */
export function CheckoutMessages({ messages }: { messages: CheckoutMessage[] }) {
  if (!messages.length) return null;
  return (
    <ul className={styles.messages} role="status" data-testid="checkout-messages">
      {messages.map((message, index) => (
        <li key={index} className={styles.message} data-level={message.level}>
          {message.text}
        </li>
      ))}
    </ul>
  );
}
