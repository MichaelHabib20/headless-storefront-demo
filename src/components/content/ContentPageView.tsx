import type { ReactNode } from 'react';
import type { ContentPage, Locale, RichText as RichTextValue } from '@/sdk';
import { externalHref } from '@/lib/routing';
import { translator } from '@/lib/i18n';
import { RichText } from '../ui/RichText';
import styles from './Content.module.css';

/**
 * A CMS page: the title (hidden for screen readers only when the merchant hid it), the merchant's
 * text (`RichText`, cleaned by the backend) and an embedded page when the API sends one. What else a
 * page shows (contact form, branches) is passed in by the route, which reads `page.kind`.
 */
export function ContentPageView({ page, locale, children }: { page: ContentPage; locale: Locale; children?: ReactNode }) {
  const t = translator(locale);
  const iframe = externalHref(page.iframeUrl);
  return (
    <article className={`container ${styles.page}`} data-testid="content-page" data-kind={page.kind}>
      <h1 className={page.showTitle ? styles.title : 'visually-hidden'}>{page.title}</h1>
      <RichText value={withoutH1(page.content)} className={styles.body} data-testid="content-body" />
      {iframe && <iframe src={iframe} title={page.title || t('contentEmbedTitle')} className={styles.iframe} loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />}
      {children}
    </article>
  );
}

/**
 * The page title above is the page's one h1, so headings level 1 that the merchant wrote in the
 * text (an "About Us" or "Cookie Policy" heading pasted from the old site) become h2: one h1 per
 * page for search engines and screen readers. Only the tag changes; attributes and text stay.
 */
export function withoutH1(value: RichTextValue | null): RichTextValue | null {
  if (!value?.html) return value;
  const html = value.html.replace(/<(\/?)h1(?=[\s>\/])/gi, '<$1h2');
  return html === value.html ? value : { ...value, html };
}
