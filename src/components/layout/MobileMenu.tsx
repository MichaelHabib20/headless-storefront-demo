'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Layout, Locale, NavItem } from '@/sdk';
import { Icon } from '../ui/Icon';
import { TargetLink } from '../ui/TargetLink';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './MobileMenu.module.css';

interface MobileMenuProps {
  layout: Layout;
  locale: Locale;
  labels: { open: string; close: string; language: string; languageLabel: string };
}

function Branch({ item, locale }: { item: NavItem; locale: Locale }) {
  if (!item.children.length) {
    return (
      <TargetLink target={item.target} locale={locale} className={styles.link}>
        {item.label}
      </TargetLink>
    );
  }
  return (
    <details className={styles.branch}>
      <summary className={styles.summary}>
        {item.label}
        <Icon name="chevron" size={18} directional className={styles.chevron} />
      </summary>
      <ul className={styles.children}>
        <li>
          <TargetLink target={item.target} locale={locale} className={`${styles.link} ${styles.all}`}>
            {item.label}
          </TargetLink>
        </li>
        {item.children.map((child, i) => (
          <li key={`${child.label}-${i}`}>
            <Branch item={child} locale={locale} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Off-canvas navigation for small screens. */
export function MobileMenu({ layout, locale, labels }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button type="button" className={styles.trigger} aria-label={labels.open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      <dialog ref={dialog} className={styles.drawer} aria-label={labels.open} onClose={() => setOpen(false)}>
        <div className={styles.head}>
          <LanguageSwitch locale={locale} label={labels.language} ariaLabel={labels.languageLabel} className={styles.language} />
          <button type="button" className={styles.close} aria-label={labels.close} onClick={() => setOpen(false)}>
            <Icon name="close" />
          </button>
        </div>
        <ul className={styles.list}>
          {layout.navigation.map((item, i) => (
            <li key={`${item.label}-${i}`}>
              <Branch item={item} locale={locale} />
            </li>
          ))}
          {layout.header.shortcuts.map((shortcut) => (
            <li key={shortcut.label}>
              <TargetLink target={shortcut.target} locale={locale} className={styles.link}>
                {shortcut.label}
              </TargetLink>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
