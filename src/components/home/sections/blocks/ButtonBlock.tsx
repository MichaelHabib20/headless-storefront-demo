import { TargetLink } from '../../../ui/TargetLink';
import type { BlockProps } from './types';
import styles from './Blocks.module.css';

/** A call to action: a link styled as a button. No target (deleted page) → its label, not a link. */
export function ButtonBlock({ block, context }: BlockProps<'button'>) {
  const label = block.label?.trim();
  if (!label) return null;
  const variant = block.variant === 'secondary' ? styles.secondary : styles.primary;
  return (
    <div className={styles.buttonWrap} data-block="button">
      <TargetLink target={block.target} locale={context.locale} className={block.target ? `${styles.button} ${variant}` : `${styles.button} ${variant} ${styles.inert}`}>
        {label}
      </TargetLink>
    </div>
  );
}
