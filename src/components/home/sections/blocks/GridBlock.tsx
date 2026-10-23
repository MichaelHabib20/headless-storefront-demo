import { drawableLeaves, renderBlock } from './renderBlock';
import type { BlockProps } from './types';
import styles from './Blocks.module.css';

/** Items in columns: the merchant's count on phones and on wider screens. */
export function GridBlock({ block, context, priority }: BlockProps<'grid'>) {
  const items = drawableLeaves(block.items, context).map((item, i) => renderBlock(item, context, i, priority && i === 0));
  if (items.length === 0) return null;
  return (
    <div
      className={`${styles.grid} ${styles[`gap_${block.gap ?? 'm'}`] ?? ''}`}
      style={{ ['--columns-mobile' as string]: block.columns?.mobile || 1, ['--columns-desktop' as string]: block.columns?.desktop || 1 }}
      data-block="grid"
    >
      {items}
    </div>
  );
}
