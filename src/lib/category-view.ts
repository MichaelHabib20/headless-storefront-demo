import type { CategoryNode, CategoryTree } from '@/sdk';

/**
 * The old storefront's category view (`/category/{cat}[/{group}]`): which node of the tree a path
 * names. Matched on the node's Target path (the slugs of the page's language, Arabic on /ar),
 * category first, then a group under it. The old page also took the English slugs on /ar, so a
 * path that only matches the other language's tree finds the same node there (by its id).
 */
export function findCategoryViewNode(tree: CategoryTree, path: readonly string[], otherTree?: CategoryTree | null): CategoryNode | null {
  if (path.length < 1 || path.length > 2) return null;
  const own = byPath(tree.items, path);
  if (own) return own;
  const other = otherTree ? byPath(otherTree.items, path) : null;
  return other ? byId(tree.items, other.id) : null;
}

/** The same node in another tree (the other language's), by its id; null when it isn't there. */
export function categoryNodeById(tree: CategoryTree, id: string): CategoryNode | null {
  return byId(tree.items, id);
}

function byPath(items: readonly CategoryNode[], path: readonly string[]): CategoryNode | null {
  const category = items.find((node) => samePath(node, path.slice(0, 1)));
  if (!category || path.length === 1) return category ?? null;
  return category.children.find((node) => samePath(node, path)) ?? null;
}

function byId(items: readonly CategoryNode[], id: string): CategoryNode | null {
  for (const node of items) {
    if (node.id === id) return node;
    const found = byId(node.children, id);
    if (found) return found;
  }
  return null;
}

function samePath(node: CategoryNode, path: readonly string[]): boolean {
  const own = node.target.path;
  return own.length === path.length && own.every((segment, i) => segment === path[i]);
}
