import type { Locale, ProductCard, SectionBlock } from '@/sdk';
import { ButtonBlock } from './ButtonBlock';
import { GridBlock } from './GridBlock';
import { ImageBlock } from './ImageBlock';
import { ProductListBlock } from './ProductListBlock';
import { renderBlock } from './renderBlock';
import { RowBlock } from './RowBlock';
import { SliderBlock } from './SliderBlock';
import { TextBlock } from './TextBlock';
import type { BlockComponents, BlockContext } from './types';
import styles from './Blocks.module.css';

/** How each block type is drawn. A type the API adds later and isn't here is skipped. */
export const blockComponents: BlockComponents = {
  slider: SliderBlock,
  grid: GridBlock,
  row: RowBlock,
  image: ImageBlock,
  text: TextBlock,
  button: ButtonBlock,
  product_list: ProductListBlock,
};

/**
 * Designs that restyle blocks, by design key (a key of src/designs/sections.json): the block types a
 * design draws its own way. Types a design leaves out are drawn by `blockComponents`. Empty for now.
 */
export const blockDesigns: Readonly<Record<string, Partial<BlockComponents>>> = {};

interface BlockRendererProps {
  blocks: SectionBlock[];
  locale: Locale;
  products: ProductCard[];
  label: string;
  /** The section has its own title (h2): heading blocks are then h3, else h2. */
  titled: boolean;
  /** The section's design (known to this storefront), or null. */
  design: string | null;
  priority?: boolean;
}

/** A section's blocks (`Section.blocks`), in the merchant's order. */
export function BlockRenderer({ blocks, locale, products, label, titled, design, priority }: BlockRendererProps) {
  const overrides = design && Object.hasOwn(blockDesigns, design) ? blockDesigns[design] : undefined;
  const components = overrides ? { ...blockComponents, ...overrides } : blockComponents;
  const context: BlockContext = { locale, products, label, headingLevel: titled ? 3 : 2, components };
  return (
    <div className={styles.blocks} data-testid="section-blocks">
      {blocks.map((block, i) => renderBlock(block, context, i, priority && i === 0))}
    </div>
  );
}
