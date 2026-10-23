import type { ComponentType } from 'react';
import type { Locale, ProductCard, SectionBlock } from '@/sdk';

/** What every block may need besides its own data. */
export interface BlockContext {
  locale: Locale;
  /** The section's own products (what `product_list` shows). */
  products: ProductCard[];
  /** Accessible name for lists and sliders: the section title, else a generic one. */
  label: string;
  /** Heading level of `text` blocks with style `heading`: 2 when the section has no title of its own. */
  headingLevel: 2 | 3;
  /** How each block type is drawn (the default ones, or a design's). */
  components: BlockComponents;
}

export type BlockType = SectionBlock['type'];

export interface BlockProps<T extends BlockType> {
  block: Extract<SectionBlock, { type: T }>;
  context: BlockContext;
  /** Above the fold: load images eagerly. */
  priority?: boolean;
}

export type BlockComponents = { [T in BlockType]: ComponentType<BlockProps<T>> };
