/** @vitest-environment jsdom */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Marketing } from '@/sdk';
import { layoutFixture } from '@/test/fixtures';
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from './CookieConsent';
import { MarketingTags } from './MarketingTags';

/** next/script renders its tags through effects; stand it in with a plain element we can find. */
vi.mock('next/script', () => ({
  default: ({ id, src, children }: { id: string; src?: string; children?: string }) => <template data-script-id={id} data-src={src ?? ''} data-code={children ?? ''} />,
}));

const NONE: Marketing = { gtmId: null, googleAnalyticsIds: [], googleAds: null, facebookPixelId: null, tiktokPixelId: null, snapchatPixelId: null, clarityId: null, hotjarId: null };
const ids = (container: HTMLElement) => [...container.querySelectorAll('[data-script-id]')].map((el) => el.getAttribute('data-script-id'));

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('MarketingTags', () => {
  it('installs nothing before the shopper accepted cookies, then installs without a reload', () => {
    const marketing = layoutFixture('en').marketing!;
    const { container } = render(<MarketingTags marketing={marketing} consentRequired />);
    expect(ids(container)).toEqual([]);

    act(() => {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
    });
    // staging ids: GTM, GA4, Meta, TikTok (no Snapchat, Clarity, Hotjar)
    expect(ids(container)).toEqual(['sc-tag-gtm', 'sc-tag-gtag-src', 'sc-tag-gtag', 'sc-tag-meta', 'sc-tag-tiktok']);
    const code = (id: string) => container.querySelector(`[data-script-id="${id}"]`)!.getAttribute('data-code')!;
    expect(code('sc-tag-gtm')).toContain('"GTM-TZC4S7KD"');
    expect(container.querySelector('[data-script-id="sc-tag-gtag-src"]')!.getAttribute('data-src')).toBe('https://www.googletagmanager.com/gtag/js?id=G-BVSC667874');
    expect(code('sc-tag-meta')).toContain(`fbq('init',"882598886877502")`);
    expect(code('sc-tag-tiktok')).toContain('ttq.load("D072PMBC77UCMMV6DJM0")');
  });

  it('installs right away when the store asks for no consent, and only the ids that are set', () => {
    const { container } = render(<MarketingTags marketing={{ ...NONE, snapchatPixelId: 'snap-1', clarityId: 'clar1', hotjarId: '3366' }} consentRequired={false} />);
    expect(ids(container)).toEqual(['sc-tag-snapchat', 'sc-tag-clarity', 'sc-tag-hotjar']);
  });

  it('installs nothing without ids, and refuses values that are not plain ids', () => {
    expect(ids(render(<MarketingTags marketing={NONE} consentRequired={false} />).container)).toEqual([]);
    expect(ids(render(<MarketingTags marketing={undefined} consentRequired={false} />).container)).toEqual([]);
    const evil = { ...NONE, gtmId: "x');alert(1);//", facebookPixelId: '<script>', hotjarId: 'abc', googleAds: { conversionId: 'AW-1', labels: {} } };
    expect(ids(render(<MarketingTags marketing={evil} consentRequired={false} />).container)).toEqual(['sc-tag-gtag-src', 'sc-tag-gtag']);
  });
});
