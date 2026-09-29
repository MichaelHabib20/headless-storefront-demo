import 'server-only';
import { createClient, type Client, type Locale } from '@/sdk';

/** Server-side legacy (auth) SDK client. The api-key never reaches the browser. */
export function storeClient(locale: Locale = 'en', token?: string): Client {
  const baseUrl = process.env.SC_API_URL;
  if (!baseUrl) throw new Error('SC_API_URL is not set. Copy .env.example to .env.local and fill it in.');
  return createClient({ baseUrl, apiKey: process.env.SC_API_KEY || undefined, locale, token });
}
