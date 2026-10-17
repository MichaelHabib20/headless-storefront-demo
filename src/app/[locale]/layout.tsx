import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed, Cairo } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getLocations, isApiError, isLocale, type Layout, type Locale, type Locations, type Me } from '@/sdk';
import { CookieConsent } from '@/components/layout/CookieConsent';
import { MarketingTags } from '@/components/layout/MarketingTags';
import { requestMetadataBase, SiteJsonLd } from '@/lib/jsonld';
import { WhatsAppButton } from '@/components/layout/FloatingActions';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { AppBanner } from '@/components/layout/AppBanner';
import { AreaChooser } from '@/components/layout/AreaChooser';
import { FloatingBanner, TopBanner } from '@/components/layout/Banners';
import { MiniCartProvider } from '@/components/layout/MiniCart';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { StoreClosedNotice } from '@/components/layout/StoreClosedNotice';
import { TopBar } from '@/components/layout/TopBar';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { UspStrip } from '@/components/layout/UspStrip';
import { ShopperStateProvider } from '@/components/shopper/ShopperStateProvider';
import { NextStepGate } from '@/components/auth/NextStepGate';
import { direction, translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { titleTemplate } from '@/lib/seo';
import { APP_BANNER_COOKIE, FLOATING_BANNER_COOKIE, floatingBannerDismissed } from '@/lib/shell';
import { chooseAreaAction, readMiniCart } from '@/lib/shell.actions';
import { readShopper } from '@/lib/session';
import { PATH_HEADER, SESSION_CHECKED_COOKIE, sessionEndUrl } from '@/lib/session-cookies';
import { loadLayout, storefrontClient } from '@/lib/storefront.server';
import '../globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-barlow', display: 'swap' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['700'], variable: '--font-barlow-condensed', display: 'swap' });
const cairo = Cairo({ subsets: ['arabic'], weight: ['400', '600', '700'], variable: '--font-cairo', display: 'swap' });

// Store content changes without deploys; render per request (data is cached by fetch revalidate).
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

/** The layout, or why there is none: the store is switched off (the merchant's message), or the API failed. */
type LayoutLoad = { layout: Layout } | { maintenance: string } | { failed: true };

async function safeLayout(locale: Locale): Promise<LayoutLoad> {
  try {
    return { layout: await loadLayout(locale) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'store_unavailable') return { maintenance: error.message };
    console.error('layout failed to load', error);
    return { failed: true };
  }
}

/**
 * Who is shopping + header counts. Never creates a guest; null when it fails (header renders without
 * badges). A customer token the backend refuses (signed out on another device, expired) can't be
 * dropped while rendering: the shopper goes through the session route handler, which drops it and
 * comes back to this page as a guest. Unless that handler just found the token working or could not
 * check it (SESSION_CHECKED_COOKIE): then the page renders as it is, so nothing can loop.
 */
async function safeMe(locale: Locale): Promise<Me | null> {
  const { me, session } = await readShopper(locale);
  if (session === 'dead' && !(await cookies()).get(SESSION_CHECKED_COOKIE)) redirect(sessionEndUrl((await headers()).get(PATH_HEADER), locale));
  return me;
}

/** The cities and areas of the area chooser (multi-inventory stores only); null when they can't be loaded. */
async function safeLocations(layout: Layout, locale: Locale): Promise<Locations | null> {
  if (!layout.areaSelection) return null;
  try {
    return await getLocations(storefrontClient(), locale);
  } catch (error) {
    console.error('locations failed to load', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const load = await safeLayout(locale);
  const layout = 'layout' in load ? load.layout : null;
  return {
    metadataBase: await requestMetadataBase(),
    // Our pages: "<page> - <store>" like the old storefront; backend titles (`seoMetadata`) are absolute.
    title: { default: layout?.store.name ?? 'Store', template: titleTemplate(layout?.store.name ?? 'Store') },
    description: layout?.store.slogan ?? undefined,
    icons: layout?.store.favicon ? [{ url: layout.store.favicon }] : undefined,
    // No `alternates` here: every page inherits them, so a page without its own would claim the home
    // page as its other language. Each page sets its canonical + hreflang (seoMetadata / ownPageAlternates).
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = translator(locale);
  const [load, me] = await Promise.all([safeLayout(locale), safeMe(locale)]);
  const layout = 'layout' in load ? load.layout : null;
  const locations = layout ? await safeLocations(layout, locale) : null;
  const jar = await cookies();
  const showAppBanner = Boolean(layout?.appBanner) && jar.get(APP_BANNER_COOKIE)?.value !== 'dismissed';
  const floating = layout?.floatingBanner && !floatingBannerDismissed(jar.get(FLOATING_BANNER_COOKIE)?.value, layout.floatingBanner.id) ? layout.floatingBanner : null;
  const hasBottomNav = Boolean(layout?.mobileNav?.items.length);
  const cookiePolicy = layout?.legal?.cookies ?? layout?.legal?.privacy ?? null;

  return (
    <html lang={locale} dir={direction(locale)} className={`${barlow.variable} ${barlowCondensed.variable} ${cairo.variable}`}>
      <body className={hasBottomNav ? 'has-bottom-nav' : undefined}>
        <a href="#main" className="skip-link">
          {t('skipToContent')}
        </a>
        {layout ? (
          // Header badges, the bottom nav and product cards read the shopper's counts and cart/wishlist/compare state from here.
          <ShopperStateProvider me={me} features={{ wishlist: layout.features.wishlist, compare: layout.features.compare }}>
            {layout.topBanner && <TopBanner banner={layout.topBanner} locale={locale} label={t('topBannerLabel')} />}
            {showAppBanner && layout.appBanner && (
              <AppBanner
                banner={layout.appBanner}
                labels={{ region: t('appBannerLabel'), dismiss: t('appBannerDismiss'), android: t('appBannerAndroid'), ios: t('appBannerIos'), huawei: t('appBannerHuawei') }}
              />
            )}
            <AnnouncementBar announcement={layout.announcement} />
            <TopBar layout={layout} locale={locale} />
            <SiteHeader layout={layout} locale={locale} me={me} />
            {layout.areaSelection && <AreaChooser locale={locale} selection={layout.areaSelection} me={me} locations={locations} choose={chooseAreaAction} />}
            <StoreClosedNotice status={layout.storeStatus} locale={locale} />
            {/* Me.next: the waiting-for-approval gate and the verify-phone / complete-profile banners. */}
            <NextStepGate
              next={me?.next ?? null}
              hrefs={{ verifyPhone: routes.verifyPhone(locale), completeProfile: routes.completeProfile(locale), waitingApproval: routes.waitingApproval(locale) }}
              labels={{
                verifyBanner: t('authVerifyBanner'),
                verifyLink: t('authVerifyBannerLink'),
                dismiss: t('authVerifyDismiss'),
                completeBanner: t('authCompleteBanner'),
                completeLink: t('authCompleteBannerLink'),
                waitingTitle: t('authWaitingTitle'),
                waitingText: t('authWaitingPending'),
                waitingLink: t('authWaitingTitle'),
              }}
            >
              <MiniCartProvider locale={locale} readCart={readMiniCart}>
                <main id="main">{children}</main>
              </MiniCartProvider>
            </NextStepGate>
            <UspStrip locale={locale} />
            <SiteFooter layout={layout} locale={locale} />
            <WhatsAppButton whatsapp={layout.whatsapp} label={t('chatOnWhatsapp')} />
            {floating && <FloatingBanner banner={floating} locale={locale} labels={{ region: t('floatingBannerLabel'), dismiss: t('floatingBannerDismiss') }} />}
            {layout.mobileNav && <MobileBottomNav nav={layout.mobileNav} locale={locale} me={me} />}
            {layout.features.cookieConsent && (
              <CookieConsent
                labels={{ text: t('cookieText'), accept: t('cookieAccept') }}
                policy={cookiePolicy ? { target: cookiePolicy, locale, label: t('cookieLearnMore') } : null}
              />
            )}
            <MarketingTags marketing={layout.marketing} consentRequired={layout.features.cookieConsent} />
            <SiteJsonLd locale={locale} />
          </ShopperStateProvider>
        ) : (
          <main id="main">{'maintenance' in load ? <StoreUnavailable locale={locale} maintenance={load.maintenance} /> : <StoreUnavailable locale={locale} />}</main>
        )}
      </body>
    </html>
  );
}
