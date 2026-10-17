import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type ContentPage, type Locale } from '@/sdk';
import { BranchesList } from '@/components/content/BranchesList';
import { ContactDetails } from '@/components/content/ContactDetails';
import { ContentForm } from '@/components/content/ContentForm';
import { ContentPageView } from '@/components/content/ContentPageView';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { loadBranches, loadPage, slugParam } from '@/lib/content.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { alternateHrefs, contentPageSeo, seoMetadata } from '@/lib/seo';
import { PageAlternates } from '@/components/layout/PageAlternates';
import { loadLayout } from '@/lib/storefront.server';
import styles from '@/components/content/Content.module.css';
import { sendContactAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [result, layout] = await Promise.all([loadPage(locale, slugParam(slug)), loadLayout(locale).catch(() => null)]);
  if (result.status !== 'ok') return { robots: { index: false } };
  return seoMetadata(contentPageSeo(result.data.seo, result.data.title, layout?.store.name), locale);
}

/**
 * A CMS page (`GET /pages/{slug}`). `page.kind` says what else it shows: the store's contact details
 * and the contact form (`contact`), or the branches (`branches`). This route is the only place that
 * reads `kind`. Structured data: `page.seo.breadcrumbs` / `structuredData` are rendered by the SEO
 * area's <JsonLd> once it is merged.
 */
export default async function CmsPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const result = await loadPage(locale, slugParam(slug));
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') {
    const t = translator(locale);
    return <MessageBlock title={t('errorTitle')} text={t('contentPageLoadError')} cta={{ href: routes.page(locale, slugParam(slug)), label: t('contentRetry') }} />;
  }

  const page = result.data;
  return (
    <ContentPageView page={page} locale={locale}>
      <PageAlternates hrefs={alternateHrefs(page.seo)} />
      {page.kind === 'contact' && <ContactBlock page={page} locale={locale} />}
      {page.kind === 'branches' && <BranchesBlock locale={locale} />}
    </ContentPageView>
  );
}

async function ContactBlock({ page, locale }: { page: ContentPage; locale: Locale }) {
  if (!page.contact) return null;
  const t = translator(locale);
  const layout = await loadLayout(locale).catch(() => null);
  return (
    <div className={styles.contactGrid}>
      <ContactDetails contact={page.contact} locale={locale} whatsappUrl={layout?.whatsapp?.url} />
      <section aria-labelledby="contact-form-title">
        <h2 id="contact-form-title" className={styles.subtitle}>
          {t('contentContactFormTitle')}
        </h2>
        <ContentForm locale={locale} fields={page.contact.fields} action={sendContactAction} submitLabel={t('contentSend')} idPrefix="contact" testId="contact-form" />
      </section>
    </div>
  );
}

async function BranchesBlock({ locale }: { locale: Locale }) {
  const result = await loadBranches(locale);
  if (result.status !== 'ok') return <p className={styles.state}>{translator(locale)('contentBranchesLoadError')}</p>;
  return <BranchesList branches={result.data} locale={locale} />;
}
