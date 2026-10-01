'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import type { Marketing } from '@/sdk';
import { configureMarketing } from '@/lib/marketing';
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from './CookieConsent';

/**
 * Installs the merchant's tags and pixels from `Layout.marketing` (GTM, GA4 + Google Ads, Meta,
 * TikTok, Snapchat, Clarity, Hotjar) — the ONLY file that knows their hosts and snippets.
 *
 * - A null id installs nothing; ids that are not plain ids are refused (no code from data).
 * - When the store asks for cookie consent (`features.cookieConsent`), nothing loads until the
 *   shopper accepted the cookie notice (same localStorage key as <CookieConsent>), and the tags
 *   load right after the click, without a reload.
 * - Events are fired by src/lib/marketing.ts; this component only installs.
 */
const ID = /^[A-Za-z0-9_-]{2,64}$/;
const safe = (id: string | null | undefined): string | null => (id && ID.test(id) ? id : null);
const js = (value: string) => JSON.stringify(value);

const snippets = {
  gtm: (id: string) =>
    `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${js(id)});`,
  gtagSrc: (id: string) => `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
  gtag: (ids: string[]) =>
    `window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());${ids.map((id) => `window.gtag('config',${js(id)});`).join('')}`,
  meta: (id: string) =>
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${js(id)});fbq('track','PageView');`,
  tiktok: (id: string) =>
    `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(${js(id)});ttq.page();}(window,document,'ttq');`,
  snapchat: (id: string) =>
    `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init',${js(id)},{});snaptr('track','PAGE_VIEW');`,
  clarity: (id: string) =>
    `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${js(id)});`,
  hotjar: (id: string) =>
    `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${Number(id)},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
};

function consented(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

export function MarketingTags({ marketing, consentRequired }: { marketing: Marketing | null | undefined; consentRequired: boolean }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const update = () => setAllowed(!consentRequired || consented());
    update();
    window.addEventListener(COOKIE_CONSENT_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, [consentRequired]);

  useEffect(() => {
    configureMarketing(allowed && marketing ? marketing : null);
  }, [allowed, marketing]);

  if (!allowed || !marketing) return null;

  const gtm = safe(marketing.gtmId);
  const googleIds = [...marketing.googleAnalyticsIds, ...(marketing.googleAds ? [marketing.googleAds.conversionId] : [])].map(safe).filter((id): id is string => id !== null);
  const meta = safe(marketing.facebookPixelId);
  const tiktok = safe(marketing.tiktokPixelId);
  const snapchat = safe(marketing.snapchatPixelId);
  const clarity = safe(marketing.clarityId);
  const hotjar = marketing.hotjarId && /^\d{1,12}$/.test(marketing.hotjarId) ? marketing.hotjarId : null;

  return (
    <>
      {gtm && <Script id="sc-tag-gtm" strategy="afterInteractive">{snippets.gtm(gtm)}</Script>}
      {googleIds.length > 0 && <Script id="sc-tag-gtag-src" strategy="afterInteractive" src={snippets.gtagSrc(googleIds[0])} />}
      {googleIds.length > 0 && <Script id="sc-tag-gtag" strategy="afterInteractive">{snippets.gtag(googleIds)}</Script>}
      {meta && <Script id="sc-tag-meta" strategy="afterInteractive">{snippets.meta(meta)}</Script>}
      {tiktok && <Script id="sc-tag-tiktok" strategy="afterInteractive">{snippets.tiktok(tiktok)}</Script>}
      {snapchat && <Script id="sc-tag-snapchat" strategy="afterInteractive">{snippets.snapchat(snapchat)}</Script>}
      {clarity && <Script id="sc-tag-clarity" strategy="afterInteractive">{snippets.clarity(clarity)}</Script>}
      {hotjar && <Script id="sc-tag-hotjar" strategy="afterInteractive">{snippets.hotjar(hotjar)}</Script>}
    </>
  );
}
