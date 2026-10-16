import Link from 'next/link';
import type { Layout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';

interface ResetUnavailableProps {
  locale: Locale;
  /** `Layout.whatsapp` (null when the store has none or the layout failed). */
  whatsapp: Layout['whatsapp'] | null;
  testId: string;
}

/**
 * The store resets no passwords online (`AuthSettings.passwordReset.method` is `none`): say so, in the
 * page language, and give the ways to reach the store: the contact page and, when the merchant set
 * one up, WhatsApp. Never an empty card.
 */
export function ResetUnavailable({ locale, whatsapp, testId }: ResetUnavailableProps) {
  const t = translator(locale);
  return (
    <div data-testid={testId}>
      <p className="muted">{t('authForgotNone')}</p>
      <p className="switch">
        <Link href={routes.contact(locale)} data-testid="reset-contact">
          {t('authForgotContact')}
        </Link>
        {whatsapp && (
          <>
            {' · '}
            <a href={whatsapp.url} target="_blank" rel="noopener noreferrer" data-testid="reset-whatsapp">
              {t('chatOnWhatsapp')}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
