'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Locale, NavItem } from '@/sdk';
import { TargetLink } from '../ui/TargetLink';
import styles from './DesktopNav.module.css';

/** Top-level categories with a full-width mega panel (hover or keyboard). */
export function DesktopNav({ items, locale }: { items: NavItem[]; locale: Locale }) {
  const [open, setOpen] = useState<number | null>(null);
  const nav = useRef<HTMLElement>(null);
  const baseId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(null);
    const onClick = (event: MouseEvent) => nav.current && !nav.current.contains(event.target as Node) && setOpen(null);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <nav ref={nav} className={styles.nav} aria-label="Main" onMouseLeave={() => setOpen(null)}>
      <ul className={styles.list}>
        {items.map((item, index) => {
          const panelId = `${baseId}-panel-${index}`;
          const hasChildren = item.children.length > 0;
          return (
            <li key={`${item.label}-${index}`} className={styles.item} onMouseEnter={() => setOpen(hasChildren ? index : null)}>
              <TargetLink target={item.target} locale={locale} className={styles.topLink}>
                {item.label}
              </TargetLink>
              {hasChildren && (
                <button
                  type="button"
                  className={styles.toggle}
                  aria-expanded={open === index}
                  aria-controls={panelId}
                  aria-label={item.label}
                  onClick={() => setOpen(open === index ? null : index)}
                >
                  <span aria-hidden="true">▾</span>
                </button>
              )}
              {hasChildren && (
                <div id={panelId} className={styles.panel} hidden={open !== index}>
                  <div className={`container ${styles.columns}`}>
                    {item.children.map((group, groupIndex) => (
                      <div key={`${group.label}-${groupIndex}`} className={styles.column}>
                        <TargetLink target={group.target} locale={locale} className={styles.groupLink}>
                          {group.label}
                        </TargetLink>
                        {group.children.length > 0 && (
                          <ul className={styles.subList}>
                            {group.children.map((leaf, leafIndex) => (
                              <li key={`${leaf.label}-${leafIndex}`}>
                                <TargetLink target={leaf.target} locale={locale} className={styles.leafLink}>
                                  {leaf.label}
                                </TargetLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
