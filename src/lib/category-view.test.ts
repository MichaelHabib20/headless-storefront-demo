import { describe, expect, it } from 'vitest';
import type { CategoryTree } from '@/sdk';
import { categoriesFixture } from '@/test/fixtures';
import { categoryNodeById, findCategoryViewNode } from './category-view';

const node = (id: string, path: string[], children: CategoryTree['items'] = []) => ({ id, name: id, image: null, target: { type: 'category' as const, path }, children });

describe('findCategoryViewNode (the old /category/{cat}[/{group}] page)', () => {
  it.each(['en', 'ar'] as const)('finds a category and a group by their Target path (%s)', (locale) => {
    const tree = categoriesFixture(locale);
    const category = tree.items[0];
    const group = category.children[0];
    expect(findCategoryViewNode(tree, category.target.path)).toBe(category);
    expect(findCategoryViewNode(tree, group.target.path)).toBe(group);
  });

  it('is null for an unknown slug, a sub-category depth, or no path', () => {
    const tree = categoriesFixture('en');
    const sub = tree.items[0].children[0].children[0];
    expect(findCategoryViewNode(tree, ['no-such-category'])).toBeNull();
    expect(findCategoryViewNode(tree, [tree.items[0].target.path[0], 'no-such-group'])).toBeNull();
    expect(findCategoryViewNode(tree, sub.target.path)).toBeNull();
    expect(findCategoryViewNode(tree, [])).toBeNull();
  });

  it('takes the English slugs on /ar, like the old page, and answers with the Arabic node', () => {
    const ar: CategoryTree = { items: [node('c1', ['عناية'], [node('g1', ['عناية', 'وجه'])])] };
    const en: CategoryTree = { items: [node('c1', ['care'], [node('g1', ['care', 'face'])])] };
    expect(findCategoryViewNode(ar, ['care', 'face'])).toBeNull();
    expect(findCategoryViewNode(ar, ['care', 'face'], en)).toBe(ar.items[0].children[0]);
    expect(findCategoryViewNode(ar, ['care'], en)).toBe(ar.items[0]);
    expect(categoryNodeById(en, 'g1')?.target.path).toEqual(['care', 'face']);
    expect(categoryNodeById(en, 'nope')).toBeNull();
  });
});
