import type { ReactNode } from 'react';
import type { Locale, PageContact } from '@/sdk';
import { translator } from '@/lib/i18n';
import { externalHref } from '@/lib/routing';
import { Icon, type IconName } from '../ui/Icon';
import styles from './Content.module.css';

interface ContactDetailsProps {
  contact: PageContact;
  locale: Locale;
  /** The chat link of the store (`Layout.whatsapp.url`); without it the number is shown as text. */
  whatsappUrl?: string | null;
}

/** The store's contact details from `Page.contact` (each line only when the API sends it). */
export function ContactDetails({ contact, locale, whatsappUrl }: ContactDetailsProps) {
  const t = translator(locale);
  const chat = externalHref(whatsappUrl);
  const lines: { key: string; icon: IconName; label: string; node: ReactNode }[] = [];
  if (contact.hotline) lines.push({ key: 'hotline', icon: 'phone', label: t('contentContactHotline'), node: <a href={`tel:${contact.hotline}`}>{contact.hotline}</a> });
  if (contact.whatsapp) {
    lines.push({
      key: 'whatsapp',
      icon: 'whatsapp',
      label: t('contentContactWhatsapp'),
      node: chat ? (
        <a href={chat} target="_blank" rel="noopener noreferrer">
          {contact.whatsapp}
        </a>
      ) : (
        <span>{contact.whatsapp}</span>
      ),
    });
  }
  if (contact.email) lines.push({ key: 'email', icon: 'link', label: t('contentContactEmail'), node: <a href={`mailto:${contact.email}`}>{contact.email}</a> });
  if (contact.address) lines.push({ key: 'address', icon: 'link', label: t('contentContactAddress'), node: <span>{contact.address}</span> });

  if (!lines.length) return null;
  return (
    <section className={styles.contact} aria-labelledby="contact-details-title" data-testid="contact-details">
      <h2 id="contact-details-title" className={styles.subtitle}>
        {t('contentContactDetails')}
      </h2>
      <dl className={styles.details}>
        {lines.map((line) => (
          <div key={line.key} className={styles.detail}>
            <dt>
              <Icon name={line.icon} size={18} />
              {line.label}
            </dt>
            <dd>{line.node}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
