import { notFound } from 'next/navigation';
import { isLocale, type Home } from '@/sdk';
import { BrandRail } from '@/components/home/BrandRail';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { PopupHost } from '@/components/home/PopupHost';
import { PromoStrip } from '@/components/home/PromoStrip';
import { HomeSection } from '@/components/home/sections/HomeSection';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { PROMO_PLACEMENTS, promoFor } from '@/lib/home';
import { translator } from '@/lib/i18n';
import { loadHome } from '@/lib/storefront.server';

/**
 * Home page. The backend decides WHAT is shown (content, order, prices, links);
 * this file decides WHERE and HOW.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  let home: Home;
  try {
    home = await loadHome(locale);
  } catch (error) {
    console.error('home failed to load', error);
    return <StoreUnavailable locale={locale} />;
  }

  const t = translator(locale);

  return (
    <>
      <h1 className="visually-hidden">{t('shopNow')}</h1>
      <PromoStrip banner={promoFor(home, PROMO_PLACEMENTS.top)} locale={locale} priority />
      <CategoryTiles tiles={home.featuredCategories} locale={locale} />
      <BrandRail brands={home.featuredBrands} locale={locale} />
      {home.sections.map((section, index) => (
        <HomeSection key={section.id} section={section} locale={locale} priority={index === 0} />
      ))}
      <PromoStrip banner={promoFor(home, PROMO_PLACEMENTS.bottom)} locale={locale} />
      <PopupHost popups={home.popups} locale={locale} closeLabel={t('close')} />
    </>
  );
}
