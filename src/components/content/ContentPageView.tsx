import type { ReactNode } from 'react';
import type { ContentPage, Locale } from '@/sdk';
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
      <RichText value={page.content} className={styles.body} data-testid="content-body" />
      {iframe && <iframe src={iframe} title={page.title || t('contentEmbedTitle')} className={styles.iframe} loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />}
      {children}
    </article>
  );
}
