import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/sdk';
import { BrandGrid } from '@/components/catalog/BrandGrid';
import styles from '@/components/catalog/Catalog.module.css';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { Pagination, positiveIntParam } from '@/components/ui/Pagination';
import { loadBrandsPage } from '@/lib/catalog.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { ownPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/** Brand tiles per page (a layout choice: 4 rows of 6 on wide screens). */
const PER_PAGE = 24;

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Itself as canonical (page 2+ keeps its `page`), both languages and x-default; any other query changes nothing. */
export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const page = positiveIntParam((await searchParams).page, 1);
  const href = (each: Locale) => (page > 1 ? `${routes.brands(each)}?page=${page}` : routes.brands(each));
  return { title: translator(locale)('brands'), alternates: ownPageAlternates(href, locale) };
}

/** The brands index, a page at a time. */
export default async function BrandsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const page = positiveIntParam((await searchParams).page, 1);
  const brands = await loadBrandsPage(locale, page, PER_PAGE);
  if (!brands) return <StoreUnavailable locale={locale} />;

  const t = translator(locale);
  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>{t('brands')}</h1>
      {brands.items.length ? <BrandGrid items={brands.items} locale={locale} /> : <p className={styles.message}>{t('catalogBrandsEmpty')}</p>}
      <Pagination
        pagination={brands.pagination}
        baseHref={routes.brands(locale)}
        locale={locale}
        labels={{ nav: t('catalogBrandsPages'), previous: t('previous'), next: t('next'), page: t('catalogPage') }}
      />
    </div>
  );
}
