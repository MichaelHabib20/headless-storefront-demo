import type { Metadata } from 'next';
import { isLocale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { ownPageAlternates } from '@/lib/seo';

/** The old storefront's /all-categories: the categories index, canonical at its own address. */
export { default } from '../categories/page';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: translator(locale)('catalogCategoriesTitle'), alternates: ownPageAlternates(routes.allCategories, locale) };
}
