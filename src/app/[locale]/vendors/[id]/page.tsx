import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; id: string }>;
type SearchParams = Promise<PageParams>;

/** A vendor id from the path (the VendorTarget's id); anything else is not a page. */
function vendorId(raw: string): number | null {
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale, id } = await params;
  const vendor = vendorId(id);
  return isLocale(locale) && vendor ? listingMetadata(locale, { vendor }, await searchParams) : {};
}

/** One seller's products (the old storefront's products?vendor_ids=). */
export default async function VendorPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, id } = await params;
  const vendor = vendorId(id);
  if (!isLocale(locale) || !vendor) notFound();
  return <ListingPage locale={locale} scope={{ vendor }} params={await searchParams} links={{ path: routes.vendor(locale, vendor) }} />;
}
