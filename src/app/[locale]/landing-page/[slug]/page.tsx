import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { PromoStrip } from '@/components/home/PromoStrip';
import { HomeSection } from '@/components/home/sections/HomeSection';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { withBannerNames } from '@/lib/banner-names.server';
import { loadLandingPage, slugParam } from '@/lib/content.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { alternateHrefs, seoMetadata } from '@/lib/seo';
import { PageAlternates } from '@/components/layout/PageAlternates';

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
  // image-only links without a name from the API are named after the page they open
  const [promoBanners, sections] = await Promise.all([
    withBannerNames(page.promoBanners, locale),
    Promise.all(page.sections.map(async (section) => ({ ...section, banners: await withBannerNames(section.banners, locale) }))),
  ]);
  return (
    <div data-testid="landing-page">
      <PageAlternates hrefs={alternateHrefs(page.seo)} />
      <h1 className="visually-hidden">{page.title ?? page.seo.title}</h1>
      {promoBanners.map((banner, index) => (
        <PromoStrip key={banner.id} banner={banner} locale={locale} priority={index === 0} />
      ))}
      {sections.map((section, index) => (
        <HomeSection key={section.id} section={section} locale={locale} priority={index === 0 && promoBanners.length === 0} />
      ))}
    </div>
  );
}
