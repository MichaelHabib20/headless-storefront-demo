import type { ComponentType } from 'react';
import type { LeafBlock, SectionBlock } from '@/sdk';
import type { BlockContext, BlockProps, BlockType } from './types';

const LEAF_TYPES: readonly string[] = ['image', 'text', 'button', 'product_list'] satisfies LeafBlock['type'][];

/** Whether a leaf has something to show (containers drop the others, so no empty slide or cell is drawn). */
function leafHasContent(block: LeafBlock, context: BlockContext): boolean {
  switch (block.type) {
    case 'image':
      return Boolean(block.media?.desktop);
    case 'text':
      return Boolean(block.text?.trim());
    case 'button':
      return Boolean(block.label?.trim());
    case 'product_list':
      return context.products.length > 0;
    default:
      return false;
  }
}

/** The leaves of a container worth drawing: known leaf types (no container inside a container) with content. */
export function drawableLeaves(items: LeafBlock[] | undefined, context: BlockContext): LeafBlock[] {
  return (items ?? []).filter((item) => typeof item?.type === 'string' && LEAF_TYPES.includes(item.type) && Object.hasOwn(context.components, item.type) && leafHasContent(item, context));
}

/** One node, drawn by the component of its type. Types this storefront doesn't know are skipped. */
export function renderBlock(block: SectionBlock | LeafBlock, context: BlockContext, index: number, priority?: boolean) {
  const type = block?.type;
  if (typeof type !== 'string' || !Object.hasOwn(context.components, type)) return null;
  const Component = context.components[type as BlockType] as ComponentType<BlockProps<BlockType>>;
  return <Component key={`${index}:${block.id ?? ''}`} block={block as BlockProps<BlockType>['block']} context={context} priority={priority} />;
}
