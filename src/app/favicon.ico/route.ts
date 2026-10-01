import { loadLayout } from '@/lib/storefront.server';

export const dynamic = 'force-dynamic';

/**
 * GET /favicon.ico: browsers and crawlers ask for it even when the page links its icon. The legacy
 * server answered 302 to the store's favicon; same here with `Layout.store.favicon` (the backend's
 * URL as it is). No favicon or no backend → 404.
 */
export async function GET(): Promise<Response> {
  let favicon: string | null = null;
  try {
    favicon = (await loadLayout('en')).store.favicon;
  } catch (error) {
    console.error('layout failed to load for the favicon', error);
  }
  if (!favicon || !/^https?:\/\//i.test(favicon)) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 302, headers: { Location: encodeURI(decodeURI(favicon)), 'Cache-Control': 'public, max-age=3600' } });
}
