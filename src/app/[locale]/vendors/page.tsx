import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { BrandGrid } from '@/components/catalog/BrandGrid';
import styles from '@/components/catalog/Catalog.module.css';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { loadVendorsPage } from '@/lib/catalog.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { ownPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: translator(locale)('vendorsTitle'), alternates: ownPageAlternates(routes.vendors, locale) };
}

/** The old storefront's /vendors: every seller as the backend lists them, each opening its products. */
export default async function VendorsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const result = await loadVendorsPage(locale);
  if (result.status === 'not-found') notFound();
  if (result.status !== 'ok') return <StoreUnavailable locale={locale} />;

  const t = translator(locale);
  const { page } = result;
  return (
    <div className={`container ${styles.page}`} data-testid="vendors-page">
      <h1 className={styles.title}>{page.title}</h1>
      {page.hint && <p className={styles.message}>{page.hint}</p>}
      {page.items.length ? <BrandGrid items={page.items} locale={locale} /> : <p className={styles.message}>{t('vendorsEmpty')}</p>}
    </div>
  );
}
