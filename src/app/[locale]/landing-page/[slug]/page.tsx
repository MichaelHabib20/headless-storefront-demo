import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { PromoStrip } from '@/components/home/PromoStrip';
import { HomeSection } from '@/components/home/sections/HomeSection';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { loadLandingPage, slugParam } from '@/lib/content.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const result = await loadLandingPage(locale, slugParam(slug));
  return result.status === 'ok' ? seoMetadata(result.data.seo, locale) : { robots: { index: false } };
}

/**
 * A merchant landing page (`GET /landing-pages/{slug}`): its promo banners, then its sections in the
 * merchant's order, drawn with the home page's blocks.
 */
export default async function LandingPageRoute({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const result = await loadLandingPage(locale, slugParam(slug));
  if (result.status === 'not-found') notFound();
  const t = translator(locale);
  if (result.status === 'error') {
    return <MessageBlock title={t('errorTitle')} text={t('contentPageLoadError')} cta={{ href: routes.landingPage(locale, slugParam(slug)), label: t('contentRetry') }} />;
  }

  const page = result.data;
  return (
    <div data-testid="landing-page">
      <h1 className="visually-hidden">{page.title ?? page.seo.title}</h1>
      {page.promoBanners.map((banner, index) => (
        <PromoStrip key={banner.id} banner={banner} locale={locale} priority={index === 0} />
      ))}
      {page.sections.map((section, index) => (
        <HomeSection key={section.id} section={section} locale={locale} priority={index === 0 && page.promoBanners.length === 0} />
      ))}
    </div>
  );
}
