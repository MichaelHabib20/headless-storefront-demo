import type { BrowserContext, Page } from '@playwright/test';

/**
 * Shared e2e helpers. Against the mock API the seeded customer token is "test-customer".
 * Against live staging (E2E_LIVE=1) we sign in with the staging test account
 * (E2E_PHONE / E2E_PASSWORD from .env.local or CI secrets — never committed) through the v3 API.
 */
export const live = process.env.E2E_LIVE === '1';
/** Ports come from the environment so several checkouts of this repo can run e2e at the same time. */
export const MOCK_API = `http://127.0.0.1:${process.env.MOCK_API_PORT ?? 4010}`;
export const APP_URL = `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const API = process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com';

const cachedTokens = new Map<string, string>();

/** Signs in through `POST /api/customer/v3/auth/sign-in` and answers the customer token (cached per account). */
export async function liveSignIn(identifier: string, password: string): Promise<string> {
  const cached = cachedTokens.get(identifier);
  if (cached) return cached;
  const res = await fetch(`${API.replace(/\/+$/, '')}/api/customer/v3/auth/sign-in`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Accept-Language': 'en', 'device-type': 'web' },
    body: JSON.stringify({ identifier, password }),
  });
  const body = (await res.json()) as { data?: { token?: string }; error?: { code?: string } };
  if (!res.ok || !body.data?.token) throw new Error(`live sign-in failed (HTTP ${res.status}, ${body.error?.code ?? 'no error code'})`);
  cachedTokens.set(identifier, body.data.token);
  return body.data.token;
}

export async function customerToken(): Promise<string> {
  if (!live) return 'test-customer';
  const phone = process.env.E2E_PHONE;
  const password = process.env.E2E_PASSWORD;
  if (!phone || !password) throw new Error('E2E_PHONE / E2E_PASSWORD are required for live e2e');
  return liveSignIn(phone, password);
}

/** Signs the browser context in as the test customer (httpOnly session cookie, like the real sign-in). */
export async function signInAsCustomer(context: BrowserContext, baseURL = APP_URL): Promise<void> {
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
