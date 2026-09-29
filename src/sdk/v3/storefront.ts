import type { StorefrontClient } from './http';
import type { Home, Layout, Locale } from './types';

/** Site chrome shared by every page: header, top bar, navigation, footer. */
export function getLayout(client: StorefrontClient, locale: Locale): Promise<Layout> {
  return client.get<Layout>('layout', locale);
}

/** Home page content: promo banners, featured categories and brands, sections, popups. */
export function getHome(client: StorefrontClient, locale: Locale): Promise<Home> {
  return client.get<Home>('home', locale);
}
