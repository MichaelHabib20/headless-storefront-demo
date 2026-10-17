import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkShopper } from '@/lib/session';
import { GET } from './route';

vi.mock('@/lib/session', () => ({ checkShopper: vi.fn() }));

function request(to: string | null, cookies: Record<string, string>) {
  const url = new URL('https://shop.test/api/session/end');
  if (to !== null) url.searchParams.set('to', to);
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest(url, { headers: { cookie } });
}

/** The cookies the answer sets, as `name=value` (a deleted one has an empty value). */
function setCookies(response: Response) {
  return response.headers.getSetCookie().map((line) => line.split(';')[0]);
}

beforeEach(() => vi.mocked(checkShopper).mockReset());

describe('GET /api/session/end', () => {
  it('a dead token: drops the customer cookies and goes back to the page as a guest', async () => {
    vi.mocked(checkShopper).mockResolvedValue({ me: null, session: 'dead' });
    const response = await GET(request('/ar/account/profile', { sc_token: 'revoked.token', sc_customer: '{}', sc_guest: 'g.1' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://shop.test/ar/account/profile');
    expect(setCookies(response)).toEqual(['sc_token=', 'sc_customer=']);
    expect(checkShopper).toHaveBeenCalledWith('ar', 'revoked.token', 'g.1');
  });

  it('a token that still works (a link from elsewhere) is kept; pages stop sending the shopper here for a minute', async () => {
    vi.mocked(checkShopper).mockResolvedValue({ me: null, session: 'live' });
    const response = await GET(request('/en/account', { sc_token: 'good.token' }));
    expect(response.headers.get('location')).toBe('https://shop.test/en/account');
    expect(setCookies(response)).toEqual(['sc_session_checked=1']);
  });

  it('the backend is down: nobody is signed out', async () => {
    vi.mocked(checkShopper).mockResolvedValue({ me: null, session: 'unknown' });
    const response = await GET(request('/en/account', { sc_token: 'good.token' }));
    expect(setCookies(response)).toEqual(['sc_session_checked=1']);
  });

  it('only comes back to a page of this storefront', async () => {
    const response = await GET(request('https://evil.test/en', {}));
    expect(response.headers.get('location')).toBe('https://shop.test/en');
    expect(checkShopper).not.toHaveBeenCalled();
    expect(setCookies(response)).toEqual([]);
  });
});
