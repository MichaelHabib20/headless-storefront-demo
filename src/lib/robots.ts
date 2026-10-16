/**
 * robots.txt text. Pure: the route (src/app/robots.txt/route.ts) decides which case applies.
 *
 * The rules are the old storefront's robots.txt (seif-online.com, its `ROBOTS_TXT` deploy variable):
 * assets allowed, the shopper's private sections and the old app's own non-pages kept out, internal
 * search, sort / filter / tracking parameters and multi-select listings kept out, then the sitemap
 * index of the canonical origin. This storefront's own filter names (`brands=`, `categories=`,
 * `inStock=`) and its API are added.
 */
import { PRIVATE_SECTIONS } from './routing';

/** Everything disallowed: a store or host that must not be indexed. */
export const DISALLOW_ALL = 'User-agent: *\nDisallow: /\n';

/** Old-app paths that were never pages for search engines (besides PRIVATE_SECTIONS). */
const OTHER_SECTIONS = ['forms', 'not-found', 'under-construction'];

const QUERY_RULES = [
  '# Internal search',
  'Disallow: /*?*search=',
  '',
  '# Sort & filter facets',
  'Disallow: /*?*sort=',
  'Disallow: /*?*price',
  'Disallow: /*?*add-to-cart=',
  'Disallow: /*?*category_id=',
  'Disallow: /*?*sub_category_id=',
  'Disallow: /*?*filter_brand=',
  'Disallow: /*?*per_page=',
  'Disallow: /*?*swp_form',
  'Disallow: /*?*route=',
  'Disallow: /*?*shop_view=',
  'Disallow: /*?*remove_item=',
  'Disallow: /*?*list_ids=',
  'Disallow: /*?*brands=',
  'Disallow: /*?*categories=',
  'Disallow: /*?*inStock=',
  '',
  '# Multi-select subcategory filters',
  'Disallow: /*/product/*--',
  '',
  '# Tracking parameters',
  'Disallow: /*?*utm_',
  'Disallow: /*?*fbclid=',
];

/** The default robots.txt of an indexable store; `origin` is the canonical origin ('' → relative sitemap URL). */
export function defaultRobotsTxt(origin: string): string {
  const sections = [...PRIVATE_SECTIONS, ...OTHER_SECTIONS].flatMap((section) => [`Disallow: /*/${section}$`, `Disallow: /*/${section}/`]);
  const lines = [
    'User-agent: *',
    ...['css', 'js', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].map((ext) => `Allow: /*.${ext}`),
    '',
    '# Checkout, customer account and other private pages',
    ...sections,
    'Disallow: /api/',
    '',
    ...QUERY_RULES,
    '',
    '# Sitemap',
    `Sitemap: ${origin}/sitemap_index.xml`,
  ];
  return `${lines.join('\n')}\n`;
}

/** A deployment's own robots.txt (`ROBOTS_TXT`), with Unix line ends and one final newline; null when empty. */
export function customRobotsTxt(value: string | undefined): string | null {
  return value && value.trim() ? value.replace(/\r\n/g, '\n').replace(/\n*$/, '\n') : null;
}
