import type { RichText as RichTextValue } from '@/sdk';
import styles from './RichText.module.css';

interface RichTextProps {
  /** A `RichText` from the API. `null` renders nothing. */
  value: RichTextValue | null | undefined;
  className?: string;
  'data-testid'?: string;
}

/**
 * Formatted text written by the merchant (product descriptions, category texts). The backend
 * cleans the HTML (no scripts, styles or event handlers), so it is shown as it is. This is the
 * only place the storefront injects HTML: never pass it anything but an API `RichText`.
 */
export function RichText({ value, className, 'data-testid': testId }: RichTextProps) {
  if (!value?.html) return null;
  return <div className={[styles.richText, className].filter(Boolean).join(' ')} data-testid={testId} dangerouslySetInnerHTML={{ __html: value.html }} />;
}
