import { describe, expect, it } from 'vitest';
import { isTokenShape, malformedSessionCookies, safeReturnTarget, sessionEndTarget, sessionEndUrl } from './session-cookies';

describe('session cookies', () => {
  it('knows what a token looks like (a JWT, or the mock tokens)', () => {
    expect(isTokenShape('eyJ0eXAi.eyJpc3Mi.J32UJb9K5Bd-o2Ty_D96')).toBe(true);
    expect(isTokenShape('test-customer')).toBe(true);
    expect(isTokenShape('')).toBe(false);
    expect(isTokenShape('abc def')).toBe(false);
    expect(isTokenShape('%7B"x"%7D')).toBe(false);
    expect(isTokenShape('a..b')).toBe(false);
    expect(isTokenShape('x'.repeat(5000))).toBe(false);
  });

  it('drops a token that is no token with its customer, and an unreadable customer alone', () => {
    expect(malformedSessionCookies('abc def', '{"id":1}')).toEqual(['sc_token', 'sc_customer']);
    expect(malformedSessionCookies('good.token', '{not json')).toEqual(['sc_customer']);
    expect(malformedSessionCookies('good.token', '"text"')).toEqual(['sc_customer']);
    expect(malformedSessionCookies('good.token', '{"id":1}')).toEqual([]);
    expect(malformedSessionCookies(undefined, undefined)).toEqual([]);
  });

  it('comes back only to a page of this storefront', () => {
    expect(safeReturnTarget('/ar/account?x=1')).toBe('/ar/account?x=1');
    expect(safeReturnTarget('/en')).toBe('/en');
    expect(safeReturnTarget('//evil.test/en')).toBeNull();
    expect(safeReturnTarget('https://evil.test/en')).toBeNull();
    expect(safeReturnTarget('/api/session/end')).toBeNull();
    expect(safeReturnTarget('/\\evil.test')).toBeNull();
    expect(safeReturnTarget('/english')).toBeNull();
    expect(safeReturnTarget(null)).toBeNull();
  });

  it('reads the session-end target and its language', () => {
    expect(sessionEndTarget('/ar/account?x=1')).toEqual({ to: '/ar/account?x=1', locale: 'ar' });
    expect(sessionEndTarget('/ar')).toEqual({ to: '/ar', locale: 'ar' });
    expect(sessionEndTarget('/en/cart')).toEqual({ to: '/en/cart', locale: 'en' });
    expect(sessionEndTarget('https://evil.test/ar')).toEqual({ to: '/en', locale: 'en' });
  });

  it('builds the session-end address', () => {
    expect(sessionEndUrl('/en/account', 'en')).toBe('/api/session/end?to=%2Fen%2Faccount');
    expect(sessionEndUrl(null, 'ar')).toBe('/api/session/end?to=%2Far');
    expect(sessionEndUrl('//evil.test', 'en')).toBe('/api/session/end?to=%2Fen');
  });
});
