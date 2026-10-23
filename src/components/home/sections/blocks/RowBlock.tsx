import { drawableLeaves, renderBlock } from './renderBlock';
import type { BlockProps } from './types';
import styles from './Blocks.module.css';

/** Items side by side (wrapping on small screens): at the start, centred, or spread out. */
export function RowBlock({ block, context, priority }: BlockProps<'row'>) {
  const items = drawableLeaves(block.items, context).map((item, i) => renderBlock(item, context, i, priority && i === 0));
  if (items.length === 0) return null;
  return (
    <div className={`${styles.row} ${styles[`row_${block.align ?? 'start'}`] ?? ''}`} data-block="row">
      {items}
    </div>
  );
}
