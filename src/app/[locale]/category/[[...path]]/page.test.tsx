/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/sdk';
import { loadCategoryTree } from '@/lib/catalog.server';
import { resolveTarget } from '@/lib/routing';
import { categoriesFixture } from '@/test/fixtures';
import CategoryViewIndexPage, { generateMetadata as indexMetadata } from '../../category-view/page';
import CategoryViewPage, { generateMetadata } from './page';

vi.mock('@/lib/catalog.server', () => ({ loadCategoryTree: vi.fn() }));

const page = (locale: string, ...path: string[]) => CategoryViewPage({ params: Promise.resolve({ locale, path: path.length ? path : undefined }) });
const meta = (locale: string, ...path: string[]) => generateMetadata({ params: Promise.resolve({ locale, path: path.length ? path : undefined }) });

describe('the old /category/... pages (category view)', () => {
  beforeEach(() => {
    vi.mocked(loadCategoryTree).mockReset().mockImplementation(async (locale: Locale) => categoriesFixture(locale));
    vi.mocked(notFound).mockReset().mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('shows a category with its groups, and "view all" opens its listing', async () => {
    const category = categoriesFixture('en').items[0];
    render(await page('en', ...category.target.path));
    expect(screen.getByRole('heading', { level: 1, name: category.name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', resolveTarget(category.target, 'en')!.href);
    expect(within(screen.getByTestId('category-tree')).getAllByTestId('category')).toHaveLength(category.children.length);
  });

  it('shows a group with its sub-categories', async () => {
    const group = categoriesFixture('ar').items[0].children[0];
    render(await page('ar', ...group.target.path.map(encodeURIComponent)));
    expect(screen.getByRole('heading', { level: 1, name: group.name })).toBeInTheDocument();
    expect(within(screen.getByTestId('category-tree')).getAllByTestId('category')).toHaveLength(group.children.length);
  });

  it('shows every category at /category and /category-view', async () => {
    const tree = categoriesFixture('en');
    render(await page('en'));
    expect(screen.getAllByTestId('category')).toHaveLength(tree.items.length);
    render(await CategoryViewIndexPage({ params: Promise.resolve({ locale: 'en' }) }));
    expect(screen.getAllByTestId('category-view')).toHaveLength(2);
  });

  it('is a 404 for a path the tree does not have', async () => {
    await expect(page('en', 'no-such-category')).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(page('fr', 'x')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('is canonical to its own address, with the page in each language (x-default Arabic)', async () => {
    const [en, ar] = [categoriesFixture('en').items[0].children[0], categoriesFixture('ar').items[0].children[0]];
    const own = `/en/category/${en.target.path.map(encodeURIComponent).join('/')}`;
    const arabic = `/ar/category/${ar.target.path.map(encodeURIComponent).join('/')}`;
    expect(await meta('en', ...en.target.path)).toEqual({
      title: en.name,
      alternates: { canonical: own, languages: { en: own, ar: arabic, 'x-default': arabic } },
    });
    expect((await meta('en')).alternates).toEqual({ canonical: '/en/category', languages: { en: '/en/category', ar: '/ar/category', 'x-default': '/ar/category' } });
    expect((await indexMetadata({ params: Promise.resolve({ locale: 'ar' }) })).alternates).toEqual({
      canonical: '/ar/category-view',
      languages: { en: '/en/category-view', ar: '/ar/category-view', 'x-default': '/ar/category-view' },
    });
    expect(await meta('en', 'no-such-category')).toEqual({ robots: { index: false } });
  });
});
