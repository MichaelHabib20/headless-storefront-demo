import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';
import { SITE_URL } from './e2e/support';

// Same env files as Next (.env.local holds the staging test account for live runs; never committed).
loadEnvConfig(process.cwd());

/**
 * E2E runs the production build against the mock API (recorded staging responses).
 * E2E_LIVE=1 runs the same tests against the real staging API instead.
 */
const live = process.env.E2E_LIVE === '1';
const mockPort = Number(process.env.MOCK_API_PORT ?? 4010);
const apiUrl = live ? (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com') : `http://127.0.0.1:${mockPort}`;
const port = Number(process.env.E2E_PORT ?? 3200);
/**
 * A second server of the same build with SC_SITE_URL set (e2e/seo.spec.ts "canonical host"): the
 * store's production address. Requests to it with that host (x-forwarded-host) are the production
 * host; requests on 127.0.0.1 are a test host of the same deployment.
 */
const sitePort = Number(process.env.E2E_SITE_PORT ?? port + 1);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(mobile|shopper-live)\.spec\.ts/ },
  ],
  webServer: [
    ...(live
      ? []
      : [{ command: 'node scripts/mock-api.mjs', url: `http://127.0.0.1:${mockPort}/health`, reuseExistingServer: false, env: { MOCK_API_PORT: String(mockPort) } }]),
    {
      command: `npx next start -p ${port}`,
      url: `http://127.0.0.1:${port}/en`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SC_API_URL: apiUrl, SC_API_KEY: '', SC_REVALIDATE_SECONDS: '0' },
    },
    ...(live
      ? []
      : [
          {
            command: `npx next start -p ${sitePort}`,
            url: `http://127.0.0.1:${sitePort}/en`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: { SC_API_URL: apiUrl, SC_API_KEY: '', SC_REVALIDATE_SECONDS: '0', SC_SITE_URL: SITE_URL },
          },
        ]),
  ],
});
