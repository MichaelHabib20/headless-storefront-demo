import type { Locale } from '@/sdk';
import { PathLocale } from '@/components/layout/PathLocale';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';

function message(locale: Locale) {
  const t = translator(locale);
  return <MessageBlock title={t('notFoundTitle')} cta={{ href: routes.home(locale), label: t('backHome') }} />;
}

// not-found can't read the route's params: both languages are rendered here and PathLocale
// draws the one of the URL (`/ar/...` → Arabic), so the page never shows two languages.
export default function NotFound() {
  return <PathLocale versions={{ en: message('en'), ar: message('ar') }} />;
}
