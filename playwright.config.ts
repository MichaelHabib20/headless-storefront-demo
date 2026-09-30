import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Same env files as Next (.env.local holds the staging test account for live runs; never committed).
loadEnvConfig(process.cwd());

/**
 * E2E runs the production build against the mock API (recorded staging responses).
 * E2E_LIVE=1 runs the same tests against the real staging API instead.
 */
const live = process.env.E2E_LIVE === '1';
const apiUrl = live ? (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com') : 'http://127.0.0.1:4010';
const port = 3200;

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
      : [{ command: 'node scripts/mock-api.mjs', url: 'http://127.0.0.1:4010/health', reuseExistingServer: false }]),
    {
      command: `npx next start -p ${port}`,
      url: `http://127.0.0.1:${port}/en`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SC_API_URL: apiUrl, SC_API_KEY: '', SC_REVALIDATE_SECONDS: '0' },
    },
  ],
});
