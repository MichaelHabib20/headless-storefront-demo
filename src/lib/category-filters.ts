import type { CategoryNode, CategoryTree, ListingFacet } from '@/sdk';

/**
 * The old storefront's "Categories" and "Sub Category" sections of a listing's filters
 * (ProductsList: the categories radio list and the selected category's groups with their
 * sub-categories as check boxes). They come from the category tree (the menu's data), not from
 * the search, so they show even when the store sends no facets. Every entry is a link to the
 * node's own Target; nothing here builds a URL.
 */
export interface CategoryFilterLink {
  id: string;
  name: string;
  /** The node's Target; a selected sub-category links to its category (unticking it, like the old check box). */
  target: CategoryNode['target'];
  selected: boolean;
  /** The link opens this very page (`aria-current`). */
  current: boolean;
}

export interface CategoryFilterGroup {
  /** The group heading; null for sub-categories without a group (the old "General" group). */
  group: CategoryFilterLink | null;
  items: CategoryFilterLink[];
}

export interface CategoryFilters {
  categories: CategoryFilterLink[];
  /** The page's category's groups; null when the page is not one category (search, brand, deals...). */
  subCategories: { groups: CategoryFilterGroup[]; open: boolean } | null;
}

/** Facet keys of the backend's own category filter (`categories` on the backend, `category` in the mock). */
const CATEGORY_FACETS = new Set(['categories', 'category']);

/** The backend sent its own category facet: "Sub category" would show the same sub-categories twice. */
export function hasCategoryFacet(facets: readonly ListingFacet[]): boolean {
  return facets.some((facet) => CATEGORY_FACETS.has(facet.key));
}

/** The old storefront's name for the group segment of a sub-category without a group. */
const GENERAL = 'general';

/**
 * Which nodes a listing's category path names, from the category down (`[category, group?, sub?]`).
 * Accepts every shape the old URLs used: `[cat]`, `[cat, group]`, `[cat, sub]`, `[cat, group, sub]`,
 * `[cat, general, sub]`; slugs match decoded and case-insensitively. On /ar a path in the other
 * language's slugs finds the same nodes there (by id), like the backend does.
 */
export function findCategoryChain(tree: CategoryTree, path: readonly string[], otherTree?: CategoryTree | null): CategoryNode[] | null {
  const own = chainOf(tree.items, path);
  if (own) return own;
  const other = otherTree ? chainOf(otherTree.items, path) : null;
  if (!other) return null;
  const mapped = other.map((node) => byId(tree.items, node.id));
  return mapped.every((node): node is CategoryNode => node !== null) ? mapped : null;
}

/**
 * The two sections for a listing. `chain` is the page's category path in the tree (null when the
 * page is not a category). Categories: every top category, the page's one selected. Sub Category:
 * the page's category's children: groups with their sub-categories, and sub-categories without a
 * group; it starts open on a sub-category page, closed otherwise (the old `showSubCategory`).
 */
export function categoryFilters(tree: CategoryTree, chain: readonly CategoryNode[] | null): CategoryFilters {
  const category = chain?.[0] ?? null;
  const currentId = chain?.length ? chain[chain.length - 1].id : null;
  const inChain = (node: CategoryNode) => chain?.some((link) => link.id === node.id) ?? false;
  const link = (node: CategoryNode, target = node.target): CategoryFilterLink => ({
    id: node.id,
    name: node.name,
    target,
    selected: inChain(node),
    current: node.id === currentId,
  });

  const categories = tree.items.map((node) => link(node));
  if (!category) return { categories, subCategories: null };

  const groups: CategoryFilterGroup[] = [];
  for (const child of category.children) {
    if (child.children.length) {
      groups.push({ group: link(child), items: child.children.map((sub) => subLink(sub)) });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last.group === null) last.items.push(subLink(child));
    else groups.push({ group: null, items: [subLink(child)] });
  }
  if (!groups.length) return { categories, subCategories: null };

  const isSub = (chain?.length ?? 0) > 1 && !chain?.[chain.length - 1].children.length;
  return { categories, subCategories: { groups, open: isSub } };

  function subLink(node: CategoryNode): CategoryFilterLink {
    const own = link(node);
    // A ticked sub-category unticks: back to its category (the old check box did the same).
    return own.selected && category ? { ...own, target: category.target, current: false } : own;
  }
}

function chainOf(categories: readonly CategoryNode[], path: readonly string[]): CategoryNode[] | null {
  const [first, second, third] = path.map(normalize);
  if (!first || path.length > 3) return null;
  const category = categories.find((node) => matches(node, first));
  if (!category) return null;
  if (path.length === 1) return [category];

  if (path.length === 2) {
    const child = category.children.find((node) => matches(node, second));
    if (child) return [category, child];
    // The old storefront retried `[cat, x]` as a sub-category of any group.
    return subChain(category, null, second);
  }

  const group = category.children.find((node) => node.children.length && matches(node, second)) ?? null;
  if (!group && second !== GENERAL) return null;
  return subChain(category, group, third);
}

/** A sub-category of a category, preferring the one under the group asked for. */
function subChain(category: CategoryNode, group: CategoryNode | null, slug: string): CategoryNode[] | null {
  if (group) {
    const sub = group.children.find((node) => matches(node, slug));
    if (sub) return [category, group, sub];
  }
  const direct = category.children.find((node) => !node.children.length && matches(node, slug));
  if (direct) return [category, direct];
  for (const child of category.children) {
    const sub = child.children.find((node) => matches(node, slug));
    if (sub) return [category, child, sub];
  }
  return null;
}

function matches(node: CategoryNode, slug: string): boolean {
  const own = node.target.path[node.target.path.length - 1];
  return own !== undefined && normalize(own) === slug;
}

function normalize(segment: string | undefined): string {
  if (segment === undefined) return '';
  let value = segment.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // already decoded
  }
  return value.toLocaleLowerCase();
}

function byId(items: readonly CategoryNode[], id: string): CategoryNode | null {
  for (const node of items) {
    if (node.id === id) return node;
    const found = byId(node.children, id);
    if (found) return found;
  }
  return null;
}
