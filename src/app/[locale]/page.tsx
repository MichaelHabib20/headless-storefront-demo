import { notFound } from 'next/navigation';
import { isLocale, type Home, type Locale } from '@/sdk';
import { BrandRail } from '@/components/home/BrandRail';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { EndOfPageCart } from '@/components/home/EndOfPageCart';
import { PopupHost } from '@/components/home/PopupHost';
import { PromoStrip } from '@/components/home/PromoStrip';
import { VendorRail } from '@/components/home/VendorRail';
import { HomeSection } from '@/components/home/sections/HomeSection';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { withBannerNames } from '@/lib/banner-names.server';
import { PROMO_PLACEMENTS, promoFor } from '@/lib/home';
import { translator } from '@/lib/i18n';
import { loadHome, loadLayout } from '@/lib/storefront.server';
import type { Metadata } from 'next';
import { JsonLd } from '@/lib/jsonld';
import { seoMetadata } from '@/lib/seo';
import { loadSiteSeo } from '@/lib/seo.server';

/** The home page meta from the backend (`Home.seo`) and the store's Google site verification. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [home, site] = await Promise.all([loadHome(locale).catch(() => null), loadSiteSeo(locale)]);
  const meta = home?.seo ? seoMetadata(home.seo, locale) : {};
  return site?.verification.google ? { ...meta, verification: { google: site.verification.google } } : meta;
}

/**
 * Home page. The backend decides WHAT is shown (content, order, prices, links);
 * this file decides WHERE and HOW.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  let home: Home;
  try {
    home = await withHomeBannerNames(await loadHome(locale), locale);
  } catch (error) {
    console.error('home failed to load', error);
    return <StoreUnavailable locale={locale} />;
  }

  const t = translator(locale);
  // The page's one h1 is the store's name, like the old storefront (not a call to action).
  const storeName = (await loadLayout(locale).catch(() => null))?.store.name;

  return (
    <>
      <h1 className="visually-hidden">{storeName || home.seo?.title}</h1>
      <PromoStrip banner={promoFor(home, PROMO_PLACEMENTS.top)} locale={locale} priority />
      <CategoryTiles tiles={home.featuredCategories} locale={locale} />
      {home.sections.map((section, index) => (
        <HomeSection key={section.id} section={section} locale={locale} priority={index === 0} />
      ))}
      <BrandRail brands={home.featuredBrands} locale={locale} />
      <VendorRail block={home.featuredVendors} locale={locale} />
      <PromoStrip banner={promoFor(home, PROMO_PLACEMENTS.bottom)} locale={locale} />
      <EndOfPageCart locale={locale} />
      <PopupHost popups={home.popups} locale={locale} closeLabel={t('close')} bannerLabel={t('bannerLabel')} />
      <JsonLd seo={home.seo} locale={locale} />
    </>
  );
}

/**
 * Every image-only link of the home page gets a name: banners without alt text or a name from the
 * API are named after the page they open (src/lib/banner-names.server.ts).
 */
async function withHomeBannerNames(home: Home, locale: Locale): Promise<Home> {
  const [sections, promoBanners, popups] = await Promise.all([
    Promise.all(home.sections.map(async (section) => ({ ...section, banners: await withBannerNames(section.banners, locale) }))),
    withBannerNames(home.promoBanners, locale),
    withBannerNames(home.popups, locale),
  ]);
  return { ...home, sections, promoBanners, popups };
}
