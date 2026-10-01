import Link from 'next/link';
import type { Layout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Icon, isIconName } from '../ui/Icon';
import { TargetLink } from '../ui/TargetLink';
import { LegalLinks } from './LegalLinks';
import { NewsletterForm } from './NewsletterForm';
import styles from './SiteFooter.module.css';

export function SiteFooter({ layout, locale }: { layout: Layout; locale: Locale }) {
  const t = translator(locale);
  const { footer, store, features } = layout;
  const appLinks = footer.appLinks ? (Object.entries(footer.appLinks) as [keyof NonNullable<typeof footer.appLinks>, string][]) : [];
  const appLabel = { android: t('androidApp'), ios: t('iosApp'), huawei: t('huaweiApp') } as const;

  return (
    <footer className={styles.footer}>
      {features.newsletter && (
        <div className={styles.newsletter}>
          <div className={`container ${styles.newsletterInner}`}>
            <h2 className={styles.newsletterTitle}>{footer.newsletter.text ?? t('newsletterTitle')}</h2>
            <NewsletterForm labels={{ email: t('newsletterEmail'), submit: t('newsletterSubmit'), soon: t('newsletterSoon') }} />
          </div>
        </div>
      )}

      <div className={`container ${styles.columns}`}>
        <div className={styles.column}>
          <h2 className={styles.heading}>{store.name ?? t('footerAbout')}</h2>
          {footer.about && <p className={styles.about}>{footer.about}</p>}
          {footer.contact.hotline && (
            <a href={`tel:${footer.contact.hotline}`} className={styles.hotline}>
              <Icon name="phone" size={18} />
              {footer.contact.hotline}
            </a>
          )}
          {footer.contact.email && (
            <a href={`mailto:${footer.contact.email}`} className={styles.link}>
              {footer.contact.email}
            </a>
          )}
          {footer.contact.address && <p className={styles.about}>{footer.contact.address}</p>}
        </div>

        <div className={styles.column}>
          <h2 className={styles.heading}>{t('footerAbout')}</h2>
          <ul className={styles.list}>
            {footer.links.map((link) => (
              <li key={link.label}>
                <TargetLink target={link.target} locale={locale} className={styles.link}>
                  {link.label}
                </TargetLink>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.column}>
          <h2 className={styles.heading}>{t('footerHelp')}</h2>
          <ul className={styles.list}>
            {features.contactPage && (
              <li>
                <Link href={routes.contact(locale)} className={styles.link}>
                  {t('contactUs')}
                </Link>
              </li>
            )}
            {features.branches && (
              <li>
                <Link href={routes.branches(locale)} className={styles.link}>
                  {t('branches')}
                </Link>
              </li>
            )}
            {features.orderTracking && (
              <li>
                <Link href={routes.trackOrder(locale)} className={styles.link}>
                  {t('trackOrder')}
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div className={styles.column}>
          <h2 className={styles.heading}>{t('footerAccount')}</h2>
          <ul className={styles.list}>
            <li>
              <Link href={routes.signIn(locale)} className={styles.link}>
                {t('signIn')}
              </Link>
            </li>
            <li>
              <Link href={routes.account(locale)} className={styles.link}>
                {t('myOrders')}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className={`container ${styles.extras}`}>
        {footer.social.length > 0 && (
          <div>
            <h2 className={styles.heading}>{t('footerFollow')}</h2>
            <ul className={styles.social}>
              {footer.social.map((profile) => (
                <li key={profile.url}>
                  <a href={profile.url} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label={profile.platform}>
                    <Icon name={isIconName(profile.platform) ? profile.platform : 'link'} size={20} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {appLinks.length > 0 && (
          <div>
            <h2 className={styles.heading}>{t('footerApps')}</h2>
            <ul className={styles.apps}>
              {appLinks.map(([platform, url]) => (
                <li key={platform}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className={styles.appLink}>
                    {appLabel[platform]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.bottom}>
        {/* shell: the merchant's legal pages (Layout.legal) */}
        <LegalLinks legal={layout.legal} locale={locale} className={`container ${styles.legal}`} linkClassName={styles.legalLink} />
        <p className="container">
          © {new Date().getFullYear()} {store.name}. {t('rights')}
        </p>
      </div>
    </footer>
  );
}
