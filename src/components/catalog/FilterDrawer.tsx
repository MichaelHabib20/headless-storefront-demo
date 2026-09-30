'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import styles from './Listing.module.css';

interface DrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
  panelId: string;
  toggle: React.RefObject<HTMLButtonElement | null>;
}

const DrawerContext = createContext<DrawerState | null>(null);

/**
 * The filters are a sidebar on wide screens and a drawer on phones. This holds the drawer's
 * state for the toggle button (next to the sort control) and the panel (the sidebar column).
 * Without JavaScript the panel simply shows above the results (see <FilterPanel>).
 */
export function FilterDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  return <DrawerContext.Provider value={{ open, setOpen, panelId, toggle }}>{children}</DrawerContext.Provider>;
}

function useDrawer(): DrawerState {
  const state = useContext(DrawerContext);
  if (!state) throw new Error('FilterToggle and FilterPanel must be inside <FilterDrawer>');
  return state;
}

/** Opens the drawer (phones only; hidden on wide screens). */
export function FilterToggle({ label }: { label: string }) {
  const { open, setOpen, panelId, toggle } = useDrawer();
  return (
    <button ref={toggle} type="button" className={styles.filterToggle} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)} data-filters-js>
      <Icon name="filter" size={18} />
      <span>{label}</span>
    </button>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="hidden"]), summary, [tabindex]:not([tabindex="-1"])';

// Without JavaScript the drawer cannot open: show the panel in the page instead.
const NO_SCRIPT_CSS = '[data-filters-panel]{display:block!important;position:static!important;inset:auto!important}[data-filters-js]{display:none!important}';

interface FilterPanelProps {
  labels: { title: string; close: string; done: string };
  children: ReactNode;
}

/** The filter panel: a sidebar on wide screens, a modal drawer on phones when opened. */
export function FilterPanel({ labels, children }: FilterPanelProps) {
  const { open, setOpen, panelId, toggle } = useDrawer();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    const toggleButton = toggle.current;
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !el) return;
      // Keep the focus inside the open drawer.
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      toggleButton?.focus();
    };
  }, [open, setOpen, toggle]);

  return (
    <>
      <div
        ref={panel}
        id={panelId}
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={titleId}
        data-filters-panel
        data-testid="listing-filters"
      >
        <div className={styles.panelHead}>
          <h2 id={titleId} className={styles.panelTitle}>
            {labels.title}
          </h2>
          <button type="button" className={styles.panelClose} aria-label={labels.close} onClick={() => setOpen(false)} data-autofocus data-filters-js>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className={styles.panelBody}>{children}</div>
        <div className={styles.panelFoot} data-filters-js>
          <button type="button" className={styles.done} onClick={() => setOpen(false)}>
            {labels.done}
          </button>
        </div>
      </div>
      <noscript>
        <style>{NO_SCRIPT_CSS}</style>
      </noscript>
    </>
  );
}
