'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import type { AreaSelection, Locale, Locations, ShopperArea } from '@/sdk';
import { translator } from '@/lib/i18n';
import type { AreaResult } from '@/lib/shell.actions';
import { areaChooserForced, OPEN_AREA_EVENT } from '@/lib/shell';
import { Icon } from '../ui/Icon';
import styles from './AreaChooser.module.css';

interface AreaChooserProps {
  locale: Locale;
  /** `Layout.areaSelection`: the label, the prompt and whether the store asks before browsing. */
  selection: AreaSelection;
  /** `Me.area` and whether the visitor has a session (null: unknown). */
  me: { authenticated: boolean; area?: ShopperArea | null } | null;
  /** `GET /locations` (cities → areas); null when it could not be loaded. */
  locations: Locations | null;
  choose: (locale: Locale, areaId: number) => Promise<AreaResult>;
}

/**
 * "Deliver to …" for multi-inventory stores. The choices are the store's cities and areas; the
 * choice is saved by the backend (`PUT /me/area`), which also decides whether the area can be
 * served. Opens by itself only when the store requires an area and the shopper (with a session)
 * has none.
 */
export function AreaChooser({ locale, selection, me, locations, choose }: AreaChooserProps) {
  const t = translator(locale);
  const router = useRouter();
  const [open, setOpen] = useState(() => areaChooserForced(selection.required, me));
  const area = me?.area ?? null;

  // The bottom nav's "area" item opens it too.
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_AREA_EVENT, show);
    return () => window.removeEventListener(OPEN_AREA_EVENT, show);
  }, []);

  return (
    <div className={styles.strip} data-testid="area-strip">
      <div className={`container ${styles.stripInner}`}>
        <span className={styles.label}>{selection.label}</span>
        <button type="button" className={styles.current} onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="area-open">
          {area ? [area.name, area.city].filter(Boolean).join(', ') : t('areaNone')}
          <span className={styles.change}>{t('areaChange')}</span>
        </button>
      </div>
      {open && (
        <AreaDialog
          locale={locale}
          selection={selection}
          area={area}
          locations={locations}
          onClose={() => setOpen(false)}
          onSave={async (areaId) => {
            const result = await choose(locale, areaId);
            if (result.ok) {
              setOpen(false);
              router.refresh();
            }
            return result;
          }}
        />
      )}
    </div>
  );
}

interface AreaDialogProps {
  locale: Locale;
  selection: AreaSelection;
  area: ShopperArea | null;
  locations: Locations | null;
  onClose: () => void;
  onSave: (areaId: number) => Promise<AreaResult>;
}

function AreaDialog({ locale, selection, area, locations, onClose, onSave }: AreaDialogProps) {
  const t = translator(locale);
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cities = locations?.cities ?? [];
  const startCity = area ? (cities.find((city) => city.areas.some((option) => option.id === area.id))?.id ?? null) : null;
  const [cityId, setCityId] = useState<number | null>(startCity);
  const [areaId, setAreaId] = useState<number | null>(area?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const areas = cities.find((city) => city.id === cityId)?.areas ?? [];

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay}>
      <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-prompt`} tabIndex={-1} data-testid="area-dialog">
        <div className={styles.head}>
          <h2 id={`${id}-title`} className={styles.title}>
            {t('areaChoose')}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('areaCancel')}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <p id={`${id}-prompt`} className={styles.prompt}>
          {selection.prompt}
        </p>
        {!locations ? (
          <p className={styles.error} role="alert">
            {t('areaLoadError')}
          </p>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (!areaId) return;
              setMessage(null);
              startTransition(async () => {
                const result = await onSave(areaId);
                if (!result.ok) setMessage(result.message);
              });
            }}
          >
            <label className={styles.field}>
              <span>{t('areaCity')}</span>
              <select
                className={styles.select}
                value={cityId ?? ''}
                onChange={(event) => {
                  setCityId(event.target.value ? Number(event.target.value) : null);
                  setAreaId(null);
                }}
                data-testid="area-city"
              >
                <option value="">{t('areaPick')}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>{t('areaArea')}</span>
              <select
                className={styles.select}
                value={areaId ?? ''}
                disabled={!areas.length}
                onChange={(event) => setAreaId(event.target.value ? Number(event.target.value) : null)}
                data-testid="area-area"
              >
                <option value="">{t('areaPick')}</option>
                {areas.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            {message && (
              <p className={styles.error} role="alert">
                {message}
              </p>
            )}
            <button type="submit" className={styles.save} disabled={!areaId || pending}>
              {pending ? t('areaSaving') : t('areaSave')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
