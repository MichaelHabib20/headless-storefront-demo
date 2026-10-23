import type { Locale, Section } from '@/sdk';
import { knownDesign, normalizeLayout } from '@/lib/home';
import { translator } from '@/lib/i18n';
import { ProductCard } from '../../product/ProductCard';
import { Rail, RailItem } from '../../ui/Rail';
import { SectionHeading } from '../../ui/SectionHeading';
import { bannerLayouts, sectionDesigns } from './BannerLayouts';
import styles from './HomeSection.module.css';

interface HomeSectionProps {
  section: Section;
  locale: Locale;
  /** The first section is above the fold: load its images eagerly. */
  priority?: boolean;
}

/** One merchant-configured section: optional title, banners in its design (else its layout), product row. */
export function HomeSection({ section, locale, priority }: HomeSectionProps) {
  const t = translator(locale);
  const layout = normalizeLayout(section.layout);
  // The merchant's design when this storefront draws it, else the layout (sections without a design: as before).
  const design = knownDesign(section.design, sectionDesigns);
  const Banners = design ? sectionDesigns[design] : bannerLayouts[layout];
  const headingId = `section-${section.id}`;
  const label = section.title ?? t('shopNow');

  return (
    <section
      className={`container ${styles.section}`}
      aria-labelledby={section.title ? headingId : undefined}
      aria-label={section.title ? undefined : label}
      data-testid="home-section"
      data-layout={layout}
      data-design={design ?? undefined}
    >
      <SectionHeading id={headingId} title={section.title} locale={locale} viewAll={section.viewAll} viewAllLabel={t('viewAll')} />
      {section.banners.length > 0 && <Banners banners={section.banners} locale={locale} label={label} priority={priority} />}
      {section.products.length > 0 && (
        <div className={section.banners.length > 0 ? styles.products : undefined}>
          <Rail label={label} previousLabel={t('previous')} nextLabel={t('next')} perView={5}>
            {section.products.map((product) => (
              <RailItem key={product.id}>
                <ProductCard product={product} locale={locale} />
              </RailItem>
            ))}
          </Rail>
        </div>
      )}
    </section>
  );
}
