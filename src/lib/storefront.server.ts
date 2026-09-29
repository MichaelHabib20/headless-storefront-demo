import 'server-only';
import { cache } from 'react';
import { createStorefrontClient, getHome, getLayout, type Locale, type StorefrontClient } from '@/sdk';

/** Server-side v3 client from environment variables. The api-key never reaches the browser. */
export function storefrontClient(): StorefrontClient {
  const baseUrl = process.env.SC_API_URL;
  if (!baseUrl) throw new Error('SC_API_URL is not set. Copy .env.example to .env.local and fill it in.');
  return createStorefrontClient({
    baseUrl,
    apiKey: process.env.SC_API_KEY || undefined,
    revalidate: Number(process.env.SC_REVALIDATE_SECONDS ?? 60),
  });
}

/** Deduplicated per request: the layout is read by both the layout and page components. */
export const loadLayout = cache((locale: Locale) => getLayout(storefrontClient(), locale));
export const loadHome = cache((locale: Locale) => getHome(storefrontClient(), locale));
