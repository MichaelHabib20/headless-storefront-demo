import type { Metadata } from 'next';
import { isLocale } from '@/sdk';
import { routes } from '@/lib/routing';
import CategoryViewPage, { generateMetadata as categoryViewMetadata } from '../category/[[...path]]/page';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

/** The old /category-view: every category, at its own address. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const meta = await categoryViewMetadata({ params: Promise.resolve({ locale }) });
  if (!isLocale(locale)) return meta;
  const languages = { en: routes.categoryViewIndex('en'), ar: routes.categoryViewIndex('ar'), 'x-default': routes.categoryViewIndex('ar') };
  return { ...meta, alternates: { canonical: routes.categoryViewIndex(locale), languages } };
}

export default function CategoryViewIndexPage({ params }: { params: Params }) {
  return CategoryViewPage({ params });
}
