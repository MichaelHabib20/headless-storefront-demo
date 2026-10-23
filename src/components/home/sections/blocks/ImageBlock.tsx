import { blockImage } from '@/lib/blocks';
import { translator } from '@/lib/i18n';
import { ResponsiveImage } from '../../../ui/ResponsiveImage';
import { TargetLink } from '../../../ui/TargetLink';
import type { BlockProps } from './types';
import styles from './Blocks.module.css';

/**
 * A picture (mobile/desktop, Arabic artwork on Arabic pages). With a target it is a link whose name is
 * the alt text, else "Banner"; without one (none set, or the linked page was deleted) it is just a picture.
 */
export function ImageBlock({ block, context, priority }: BlockProps<'image'>) {
  if (!block.media?.desktop) return null;
  const alt = block.alt?.trim() ?? '';
  if (!block.target) {
    return (
      <div className={styles.image} data-block="image">
        <ResponsiveImage image={blockImage(block, context.locale, alt)} priority={priority} className={styles.picture} />
      </div>
    );
  }
  const name = alt || translator(context.locale)('bannerLabel');
  return (
    <div className={styles.image} data-block="image">
      <TargetLink target={block.target} locale={context.locale} className={styles.imageLink}>
        <ResponsiveImage image={blockImage(block, context.locale, name)} priority={priority} className={styles.picture} />
      </TargetLink>
    </div>
  );
}
