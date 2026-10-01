import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed, Cairo } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getMe, isLocale, type Layout, type Locale, type Me } from '@/sdk';
import { CookieConsent } from '@/components/layout/CookieConsent';
import { MarketingTags } from '@/components/layout/MarketingTags';
import { requestMetadataBase, SiteJsonLd } from '@/lib/jsonld';
import { WhatsAppButton } from '@/components/layout/FloatingActions';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { TopBar } from '@/components/layout/TopBar';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { ShopperStateProvider } from '@/components/shopper/ShopperStateProvider';
import { direction, translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { shopperContext } from '@/lib/shopper.server';
import { loadLayout, storefrontClient } from '@/lib/storefront.server';
import '../globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-barlow', display: 'swap' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['700'], variable: '--font-barlow-condensed', display: 'swap' });
const cairo = Cairo({ subsets: ['arabic'], weight: ['400', '600', '700'], variable: '--font-cairo', display: 'swap' });

// Store content changes without deploys; render per request (data is cached by fetch revalidate).
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

async function safeLayout(locale: Locale): Promise<Layout | null> {
  try {
    return await loadLayout(locale);
  } catch (error) {
    console.error('layout failed to load', error);
    return null;
  }
}

/** Who is shopping + header counts. Never creates a guest; null when it fails (header renders without badges). */
async function safeMe(locale: Locale): Promise<Me | null> {
  try {
    return await getMe(storefrontClient(), await shopperContext(locale));
  } catch (error) {
    console.error('me failed to load', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const layout = await safeLayout(locale);
  return {
    metadataBase: await requestMetadataBase(),
    title: { default: layout?.store.name ?? 'Store', template: `%s | ${layout?.store.name ?? 'Store'}` },
    description: layout?.store.slogan ?? undefined,
    icons: layout?.store.favicon ? [{ url: layout.store.favicon }] : undefined,
    alternates: { languages: { en: routes.home('en'), ar: routes.home('ar') } },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = translator(locale);
  const [layout, me] = await Promise.all([safeLayout(locale), safeMe(locale)]);

  return (
    <html lang={locale} dir={direction(locale)} className={`${barlow.variable} ${barlowCondensed.variable} ${cairo.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          {t('skipToContent')}
        </a>
        {layout ? (
          <>
            <AnnouncementBar announcement={layout.announcement} />
            <TopBar layout={layout} locale={locale} />
            <SiteHeader layout={layout} locale={locale} me={me} />
            {/* Product cards on any page read the shopper's cart/wishlist/compare state from here. */}
            <ShopperStateProvider me={me} features={{ wishlist: layout.features.wishlist, compare: layout.features.compare }}>
              <main id="main">{children}</main>
            </ShopperStateProvider>
            <SiteFooter layout={layout} locale={locale} />
            <WhatsAppButton whatsapp={layout.whatsapp} label={t('chatOnWhatsapp')} />
            {layout.features.cookieConsent && <CookieConsent labels={{ text: t('cookieText'), accept: t('cookieAccept') }} />}
            <MarketingTags marketing={layout.marketing} consentRequired={layout.features.cookieConsent} />
            <SiteJsonLd locale={locale} />
          </>
        ) : (
          <main id="main">
            <StoreUnavailable locale={locale} />
          </main>
        )}
      </body>
    </html>
  );
}
