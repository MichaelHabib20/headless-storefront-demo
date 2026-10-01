import type { BranchesPage, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { externalHref } from '@/lib/routing';
import { Icon } from '../ui/Icon';
import styles from './Content.module.css';

/** The store's branches in the merchant's groups; the map link is the API's `mapUrl` (opened outside the store). */
export function BranchesList({ branches, locale }: { branches: BranchesPage; locale: Locale }) {
  const t = translator(locale);
  const groups = branches.groups.filter((group) => group.branches.length > 0);
  if (!groups.length) return <p className={styles.empty}>{t('contentBranchesEmpty')}</p>;

  return (
    <div className={styles.branches} data-testid="branches">
      {groups.map((group, index) => (
        <section key={`${group.name}-${index}`} aria-labelledby={`branch-group-${index}`}>
          <h2 id={`branch-group-${index}`} className={styles.subtitle}>
            {group.name}
          </h2>
          <ul className={styles.branchList}>
            {group.branches.map((branch) => {
              const map = externalHref(branch.mapUrl);
              return (
                <li key={branch.id} className={styles.branch} data-testid="branch">
                  {branch.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- merchant image from any CDN
                    <img src={branch.image} alt="" className={styles.branchImage} loading="lazy" />
                  )}
                  <h3 className={styles.branchName}>{branch.name}</h3>
                  {branch.area && <p className={styles.branchArea}>{branch.area}</p>}
                  {branch.address && <p>{branch.address}</p>}
                  {branch.phone && (
                    <p>
                      <span className="visually-hidden">{t('contentBranchPhone')}: </span>
                      <Icon name="phone" size={16} /> {branch.phone}
                    </p>
                  )}
                  {branch.email && (
                    <p>
                      <span className="visually-hidden">{t('contentBranchEmail')}: </span>
                      <a href={`mailto:${branch.email}`}>{branch.email}</a>
                    </p>
                  )}
                  {map && (
                    <a href={map} target="_blank" rel="noopener noreferrer" className={styles.mapLink} data-testid="branch-map">
                      {t('contentBranchMap')}
                      <Icon name="arrow" size={16} directional />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
