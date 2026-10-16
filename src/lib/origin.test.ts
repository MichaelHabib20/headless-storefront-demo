import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuredOrigin, isTestHost, publicOrigin, requestHost, requestOrigin } from './origin';

const headers = (values: Record<string, string>) => new Headers(values);

afterEach(() => vi.unstubAllEnvs());

describe('the public origin (canonical, hreflang, og:url, sitemaps, robots.txt)', () => {
  it('SC_SITE_URL: a plain http(s) origin, without the trailing slash, lower case; anything else is ignored', () => {
    expect(configuredOrigin('https://Seif-Online.com/')).toBe('https://seif-online.com');
    expect(configuredOrigin(' http://127.0.0.1:3356 ')).toBe('http://127.0.0.1:3356');
    for (const bad of [undefined, '', '   ', 'seif-online.com', 'javascript:alert(1)', 'https://seif-online.com/en', 'https://a.test?x=1', 'ftp://a.test']) {
      expect(configuredOrigin(bad)).toBeNull();
    }
  });

  it('without SC_SITE_URL: the origin of the request (the test host stays itself)', () => {
    vi.stubEnv('SC_SITE_URL', '');
    const vercel = headers({ host: 'seif-storefront.vercel.app', 'x-forwarded-proto': 'https' });
    expect(publicOrigin(vercel)).toBe('https://seif-storefront.vercel.app');
    expect(isTestHost(vercel)).toBe(false);
    expect(publicOrigin(headers({}))).toBe('');
  });

  it('with SC_SITE_URL: every URL uses it, whatever host the request came in on', () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com/');
    expect(publicOrigin(headers({ host: 'seif-storefront.vercel.app' }))).toBe('https://seif-online.com');
    expect(publicOrigin(headers({ host: 'seif-online.com' }))).toBe('https://seif-online.com');
    expect(publicOrigin(headers({}))).toBe('https://seif-online.com');
  });

  it('a host other than the configured one is a test host (the vercel.app alias, a preview, www)', () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    expect(isTestHost(headers({ host: 'seif-online.com' }))).toBe(false);
    expect(isTestHost(headers({ host: 'SEIF-ONLINE.COM' }))).toBe(false);
    expect(isTestHost(headers({ host: 'internal:3000', 'x-forwarded-host': 'seif-online.com' }))).toBe(false);
    expect(isTestHost(headers({ host: 'seif-storefront.vercel.app' }))).toBe(true);
    expect(isTestHost(headers({ host: 'seif-online.com', 'x-forwarded-host': 'preview-123.vercel.app' }))).toBe(true);
    expect(isTestHost(headers({ host: 'www.seif-online.com' }))).toBe(true);
    expect(isTestHost(headers({}))).toBe(true);
  });

  it('an invalid SC_SITE_URL is as if it were not set', () => {
    vi.stubEnv('SC_SITE_URL', 'seif-online.com');
    const request = headers({ host: 'shop.test' });
    expect(publicOrigin(request)).toBe('https://shop.test');
    expect(isTestHost(request)).toBe(false);
  });

  it('reads the request host and origin safely', () => {
    expect(requestHost(headers({ host: 'a.test', 'x-forwarded-host': 'b.test, proxy' }))).toBe('b.test');
    expect(requestHost(headers({ host: 'evil.com/"><script>' }))).toBeNull();
    expect(requestOrigin(headers({ host: '127.0.0.1:3355' }))).toBe('http://127.0.0.1:3355');
  });
});
