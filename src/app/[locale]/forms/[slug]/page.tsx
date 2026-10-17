import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ContentForm } from '@/components/content/ContentForm';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { loadForm, slugParam } from '@/lib/content.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { seoMetadata } from '@/lib/seo';
import styles from '@/components/content/Content.module.css';
import { submitFormAction, uploadFormFileAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const result = await loadForm(locale, slugParam(slug));
  return result.status === 'ok' ? seoMetadata(result.data.seo, locale) : { robots: { index: false } };
}

/**
 * A merchant form (`GET /forms/{slug}`), drawn from its `fields`, open to every visitor like the old
 * storefront. `requiresSignIn` means "needs a shopper session" and a guest session is enough (the
 * backend's FormsController / UploadsController take a guest token): the upload and send server
 * actions start the guest session (`withShopper`), so rendering still never creates one.
 * The title is always shown: on its own the form (one upload tile) does not say what it is for.
 */
export default async function MerchantFormPage({ params }: { params: Params }) {
  const { locale, slug: raw } = await params;
  if (!isLocale(locale)) notFound();
  const slug = slugParam(raw);
  const result = await loadForm(locale, slug);
  if (result.status === 'not-found') notFound();
  const t = translator(locale);
  if (result.status === 'error') {
    return <MessageBlock title={t('errorTitle')} text={t('contentPageLoadError')} cta={{ href: routes.form(locale, slug), label: t('contentRetry') }} />;
  }

  const form = result.data;
  return (
    <article className={`container ${styles.page} ${styles.formPage}`} data-testid="merchant-form-page">
      <h1 className={styles.title}>{form.title}</h1>
      <div className={styles.formCard}>
        <ContentForm
          locale={locale}
          fields={form.fields}
          action={submitFormAction}
          submitLabel={form.submitLabel}
          hidden={{ slug: form.slug }}
          upload={uploadFormFileAction}
          idPrefix={`form-${form.slug}`}
          testId="merchant-form"
        />
      </div>
    </article>
  );
}
