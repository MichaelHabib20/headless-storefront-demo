import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type CategoryNode, type CategoryTree as Tree, type Locale } from '@/sdk';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import styles from '@/components/catalog/Catalog.module.css';
import { PageAlternates } from '@/components/layout/PageAlternates';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { TargetLink } from '@/components/ui/TargetLink';
import { loadCategoryTree } from '@/lib/catalog.server';
import { categoryNodeById, findCategoryViewNode } from '@/lib/category-view';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; path?: string[] }>;

/** Next hands dynamic segments over percent-encoded (`%D8%A7…` for an Arabic slug). */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const otherLocale = (locale: Locale): Locale => (locale === 'en' ? 'ar' : 'en');

interface View {
  tree: Tree;
  /** null: every category (/category alone) */
  node: CategoryNode | null;
  path: string[];
}

/** The tree and the node the path names; null when the store is down, 'missing' for a path the tree doesn't have. */
async function loadView(locale: Locale, raw: string[] | undefined): Promise<View | 'missing' | null> {
  const path = (raw ?? []).map(decode);
  const tree = await loadCategoryTree(locale);
  if (!tree) return null;
  if (!path.length) return { tree, node: null, path };
  const node = findCategoryViewNode(tree, path) ?? findCategoryViewNode(tree, path, await loadCategoryTree(otherLocale(locale)));
  return node ? { tree, node, path } : 'missing';
}

/** The page in each language: the same node, at its own slugs; x-default the Arabic page, like the old storefront. */
async function languages(locale: Locale, view: View): Promise<Record<string, string>> {
  const other = otherLocale(locale);
  const links: Record<string, string> = { [locale]: routes.categoryView(locale, view.path) };
  if (!view.node) links[other] = routes.categoryView(other);
  else {
    const otherTree = await loadCategoryTree(other);
    const same = otherTree ? categoryNodeById(otherTree, view.node.id) : null;
    if (same) links[other] = routes.categoryView(other, same.target.path);
  }
  if (links.ar) links['x-default'] = links.ar;
  return links;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, path } = await params;
  if (!isLocale(locale)) return {};
  const view = await loadView(locale, path);
  if (view === null) return {};
  if (view === 'missing') return { robots: { index: false } };
  return {
    title: view.node?.name ?? translator(locale)('catalogCategoriesTitle'),
    // the page at its own address, as the old storefront served it
    alternates: { canonical: routes.categoryView(locale, view.path), languages: await languages(locale, view) },
  };
}

/**
 * The old storefront's category view, kept at its address: `/category/{cat}` a category's groups
 * (with their sub-categories), `/category/{cat}/{group}` a group's sub-categories, `/category`
 * every category. "View all" opens the node's listing (/product/...).
 */
export default async function CategoryViewPage({ params }: { params: Params }) {
  const { locale, path } = await params;
  if (!isLocale(locale)) notFound();

  const view = await loadView(locale, path);
  if (view === null) return <StoreUnavailable locale={locale} />;
  if (view === 'missing') notFound();

  const t = translator(locale);
  const { node, tree } = view;
  const items = node ? node.children : tree.items;
  const { en, ar } = await languages(locale, view);
  return (
    <div className={`container ${styles.page}`} data-testid="category-view">
      <PageAlternates hrefs={{ en, ar }} />
      <h1 className={styles.title}>{node ? node.name : t('catalogCategoriesTitle')}</h1>
      {node && (
        <TargetLink target={node.target} locale={locale}>
          {t('viewAll')}
        </TargetLink>
      )}
      {items.length ? <CategoryTree items={items} locale={locale} /> : !node && <p className={styles.message}>{t('catalogCategoriesEmpty')}</p>}
    </div>
  );
}
