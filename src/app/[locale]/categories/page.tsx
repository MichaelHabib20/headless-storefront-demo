import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import styles from '@/components/catalog/Catalog.module.css';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { loadCategoryTree } from '@/lib/catalog.server';
import { translator } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('catalogCategoriesTitle') : undefined };
}

/** Every category, group and sub-category of the store. */
export default async function CategoriesPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const tree = await loadCategoryTree(locale);
  if (!tree) return <StoreUnavailable locale={locale} />;

  const t = translator(locale);
  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>{t('catalogCategoriesTitle')}</h1>
      {tree.items.length ? <CategoryTree items={tree.items} locale={locale} /> : <p className={styles.message}>{t('catalogCategoriesEmpty')}</p>}
    </div>
  );
}
