import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ContentForm } from '@/components/content/ContentForm';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { loadForm, slugParam } from '@/lib/content.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { seoMetadata } from '@/lib/seo';
import { shopperContext } from '@/lib/shopper.server';
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
 * A merchant form (`GET /forms/{slug}`), drawn from its `fields`. When the API says it needs a
 * session (`requiresSignIn`) and the visitor has none, a sign-in prompt is shown instead: rendering
 * never starts a guest session.
 */
export default async function MerchantFormPage({ params }: { params: Params }) {
  const { locale, slug: raw } = await params;
  if (!isLocale(locale)) notFound();
  const slug = slugParam(raw);
  const result = await loadForm(locale, slug);
  if (result.status === 'not-found') notFound();
  const t = translator(locale);
  const here = routes.form(locale, slug);
  if (result.status === 'error') {
    return <MessageBlock title={t('errorTitle')} text={t('contentPageLoadError')} cta={{ href: here, label: t('contentRetry') }} />;
  }

  const form = result.data;
  const signedOut = form.requiresSignIn && !(await shopperContext(locale)).token;

  return (
    <article className={`container ${styles.page}`} data-testid="merchant-form-page">
      <h1 className={form.showTitle ? styles.title : 'visually-hidden'}>{form.title}</h1>
      {signedOut ? (
        <div className={styles.signIn} data-testid="form-sign-in">
          <h2 className={styles.subtitle}>{t('contentFormSignInTitle')}</h2>
          <p>{t('contentFormSignInText')}</p>
          <Link href={routes.signIn(locale, here)} className={styles.primary}>
            {t('contentFormSignInCta')}
          </Link>
        </div>
      ) : (
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
      )}
    </article>
  );
}
