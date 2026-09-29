import type { BrowserContext, Page } from '@playwright/test';

/**
 * Shared e2e helpers. Against the mock API the seeded customer token is "test-customer".
 * Against live staging (E2E_LIVE=1) we sign in with the staging test account
 * (E2E_PHONE / E2E_PASSWORD from .env.local or CI secrets — never committed).
 */
export const live = process.env.E2E_LIVE === '1';
export const MOCK_API = 'http://127.0.0.1:4010';
const API = process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com';

let cachedToken: string | null = null;

export async function customerToken(): Promise<string> {
  if (!live) return 'test-customer';
  if (cachedToken) return cachedToken;
  const phone = process.env.E2E_PHONE;
  const password = process.env.E2E_PASSWORD;
  if (!phone || !password) throw new Error('E2E_PHONE / E2E_PASSWORD are required for live e2e');
  const res = await fetch(`${API.replace(/\/+$/, '')}/api/customer/auth`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', lang: '1' },
    body: JSON.stringify({ phone, password }),
  });
  const body = (await res.json()) as { code: number; data?: { token?: string } };
  if (body.code !== 200 || !body.data?.token) throw new Error(`live sign-in failed (code ${body.code})`);
  cachedToken = body.data.token;
  return cachedToken;
}

/** Signs the browser context in as the test customer (httpOnly session cookie, like the real sign-in). */
export async function signInAsCustomer(context: BrowserContext, baseURL = 'http://127.0.0.1:3200'): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies([{ name: 'sc_token', value: await customerToken(), domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

/** Fresh mock state before each test (no-op live). */
export async function resetMock(page: Page): Promise<void> {
  if (live) return;
  await page.request.post(`${MOCK_API}/__reset`);
}

export async function acceptCookies(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
}
