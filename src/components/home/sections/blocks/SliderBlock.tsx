import { translator } from '@/lib/i18n';
import { Rail, RailItem } from '../../../ui/Rail';
import { drawableLeaves, renderBlock } from './renderBlock';
import type { BlockProps } from './types';

const DEFAULT_INTERVAL_MS = 5000;

/** One item at a time with previous/next buttons; moves on its own when the merchant turned autoplay on. */
export function SliderBlock({ block, context, priority }: BlockProps<'slider'>) {
  const t = translator(context.locale);
  const items = drawableLeaves(block.items, context).map((item, i) => renderBlock(item, context, i, priority && i === 0));
  if (items.length === 0) return null;
  return (
    <div data-block="slider">
      <Rail label={context.label} previousLabel={t('previous')} nextLabel={t('next')} perView={1} autoplayMs={block.autoplay ? block.interval_ms || DEFAULT_INTERVAL_MS : undefined}>
        {items.map((item, i) => (
          <RailItem key={i}>{item}</RailItem>
        ))}
      </Rail>
    </div>
  );
}
