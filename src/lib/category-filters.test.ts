import { describe, expect, it } from 'vitest';
import type { CategoryNode, CategoryTree } from '@/sdk';
import { categoriesFixture } from '@/test/fixtures';
import { categoryFilters, findCategoryChain, hasCategoryFacet } from './category-filters';

const node = (id: string, path: string[], children: CategoryNode[] = []): CategoryNode => ({ id, name: `name-${id}`, image: null, target: { type: 'category', path }, children });

// care → face (group: cream, wash) + loose sub "soap" (the old "General" group), body (group: lotion)
const tree: CategoryTree = {
  items: [
    node('c1', ['care'], [
      node('g1', ['care', 'face'], [node('s1', ['care', 'face', 'cream']), node('s2', ['care', 'face', 'wash'])]),
      node('s3', ['care', 'soap']),
      node('g2', ['care', 'body'], [node('s4', ['care', 'body', 'lotion'])]),
    ]),
    node('c2', ['baby'], []),
  ],
};
const ids = (chain: CategoryNode[] | null) => chain?.map((n) => n.id) ?? null;

describe('findCategoryChain (which tree nodes a /product/... path names)', () => {
  it('takes every shape of the old URLs', () => {
    expect(ids(findCategoryChain(tree, ['care']))).toEqual(['c1']);
    expect(ids(findCategoryChain(tree, ['care', 'face']))).toEqual(['c1', 'g1']);
    expect(ids(findCategoryChain(tree, ['care', 'face', 'wash']))).toEqual(['c1', 'g1', 's2']);
    expect(ids(findCategoryChain(tree, ['care', 'soap']))).toEqual(['c1', 's3']);
    expect(ids(findCategoryChain(tree, ['care', 'general', 'soap']))).toEqual(['c1', 's3']);
    // [cat, sub] of a sub in a group (the old storefront retried the group as a sub)
    expect(ids(findCategoryChain(tree, ['care', 'lotion']))).toEqual(['c1', 'g2', 's4']);
    // a sub asked under another group still finds it
    expect(ids(findCategoryChain(tree, ['care', 'face', 'lotion']))).toEqual(['c1', 'g2', 's4']);
  });

  it('matches decoded and case-insensitively', () => {
    const ar: CategoryTree = { items: [node('c9', ['عناية'], [node('s9', ['عناية', 'صابون'])])] };
    expect(ids(findCategoryChain(ar, [encodeURIComponent('عناية'), 'صابون']))).toEqual(['c9', 's9']);
    expect(ids(findCategoryChain(tree, ['CARE', 'Face']))).toEqual(['c1', 'g1']);
  });

  it('is null for unknown paths', () => {
    expect(findCategoryChain(tree, [])).toBeNull();
    expect(findCategoryChain(tree, ['nope'])).toBeNull();
    expect(findCategoryChain(tree, ['care', 'nope'])).toBeNull();
    expect(findCategoryChain(tree, ['care', 'nope', 'cream'])).toBeNull();
    expect(findCategoryChain(tree, ['care', 'face', 'cream', 'more'])).toBeNull();
  });

  it('finds English slugs on /ar through the other tree, answering with the Arabic nodes', () => {
    const ar: CategoryTree = { items: [node('c1', ['عناية'], [node('g1', ['عناية', 'وجه'], [node('s1', ['عناية', 'وجه', 'كريم'])])])] };
    expect(findCategoryChain(ar, ['care', 'face', 'cream'])).toBeNull();
    const chain = findCategoryChain(ar, ['care', 'face', 'cream'], tree);
    expect(chain?.map((n) => n.target.path.at(-1))).toEqual(['عناية', 'وجه', 'كريم']);
  });

  it.each(['en', 'ar'] as const)('finds the recorded tree’s nodes by their own Target paths (%s)', (locale) => {
    const recorded = categoriesFixture(locale);
    const category = recorded.items.find((n) => n.children.some((g) => g.children.length))!;
    const group = category.children.find((g) => g.children.length)!;
    const sub = group.children[group.children.length - 1];
    expect(ids(findCategoryChain(recorded, sub.target.path))).toEqual([category.id, group.id, sub.id]);
  });
});

describe('categoryFilters (the old Categories / Sub category sections)', () => {
  it('lists every top category and no sub-categories on a page without a category', () => {
    const filters = categoryFilters(tree, null);
    expect(filters.categories.map((c) => [c.id, c.selected])).toEqual([
      ['c1', false],
      ['c2', false],
    ]);
    expect(filters.subCategories).toBeNull();
  });

  it('on a category page: the category selected and current, its groups and loose subs, closed', () => {
    const filters = categoryFilters(tree, findCategoryChain(tree, ['care']));
    expect(filters.categories[0]).toMatchObject({ id: 'c1', selected: true, current: true });
    expect(filters.subCategories?.open).toBe(false);
    expect(filters.subCategories?.groups.map((g) => [g.group?.id ?? null, g.items.map((i) => i.id)])).toEqual([
      ['g1', ['s1', 's2']],
      [null, ['s3']],
      ['g2', ['s4']],
    ]);
  });

  it('on a sub-category page: open, the chain selected, and the ticked sub links back to its category', () => {
    const filters = categoryFilters(tree, findCategoryChain(tree, ['care', 'face', 'wash']));
    const groups = filters.subCategories!.groups;
    expect(filters.subCategories?.open).toBe(true);
    expect(groups[0].group).toMatchObject({ id: 'g1', selected: true, current: false, target: { path: ['care', 'face'] } });
    expect(groups[0].items[1]).toMatchObject({ id: 's2', selected: true, current: false, target: { path: ['care'] } });
    expect(groups[0].items[0]).toMatchObject({ id: 's1', selected: false, target: { path: ['care', 'face', 'cream'] } });
    expect(groups[1].items[0]).toMatchObject({ id: 's3', selected: false });
  });

  it('on a group page: the group current, the section closed', () => {
    const filters = categoryFilters(tree, findCategoryChain(tree, ['care', 'body']));
    expect(filters.subCategories?.open).toBe(false);
    expect(filters.subCategories?.groups[2].group).toMatchObject({ id: 'g2', selected: true, current: true });
  });

  it('a category without children has no Sub category section', () => {
    expect(categoryFilters(tree, findCategoryChain(tree, ['baby'])).subCategories).toBeNull();
  });
});

describe('hasCategoryFacet', () => {
  const facet = (key: string) => ({ key, label: key, kind: 'options' as const, display: 'list' as const, values: [], range: null });
  it('knows the backend’s categories facet (and the mock’s category one)', () => {
    expect(hasCategoryFacet([facet('brands'), facet('categories')])).toBe(true);
    expect(hasCategoryFacet([facet('category')])).toBe(true);
    expect(hasCategoryFacet([facet('brands'), facet('price')])).toBe(false);
    expect(hasCategoryFacet([])).toBe(false);
  });
});
