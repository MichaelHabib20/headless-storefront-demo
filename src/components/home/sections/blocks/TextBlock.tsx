import type { BlockProps } from './types';
import styles from './Blocks.module.css';

/** The merchant's text, already in the page's language: a heading, a paragraph or a small caption. */
export function TextBlock({ block, context }: BlockProps<'text'>) {
  const text = block.text?.trim();
  if (!text) return null;
  const className = `${styles.text} ${styles[`text_${block.style}`] ?? ''} ${styles[`align_${block.align ?? 'start'}`] ?? ''}`;
  if (block.style === 'heading') {
    const Heading = context.headingLevel === 2 ? 'h2' : 'h3';
    return (
      <Heading className={className} data-block="text">
        {text}
      </Heading>
    );
  }
  return (
    <p className={className} data-block="text">
      {text}
    </p>
  );
}
