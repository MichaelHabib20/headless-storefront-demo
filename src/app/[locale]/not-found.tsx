import { MessageBlock } from '@/components/layout/StoreUnavailable';

// not-found can't read params; the layout already set the language, so keep it bilingual.
export default function NotFound() {
  return <MessageBlock title="Page not found · الصفحة غير موجودة" cta={{ href: '/', label: 'Home · الرئيسية' }} />;
}
