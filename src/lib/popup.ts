import type { Popup } from '@/sdk';

export interface PopupMemory {
  /** ISO timestamps of when each popup id was last shown */
  shownAt: Record<string, string>;
  /** popup ids shown in the current browser session */
  sessionShown: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The backend says how often a popup may appear (`frequency`); remembering what
 * this visitor already saw is the storefront's job.
 */
export function pickPopup(popups: readonly Popup[], memory: PopupMemory, now: Date): Popup | null {
  for (const popup of popups) {
    if (shouldShow(popup, memory, now)) return popup;
  }
  return null;
}

export function shouldShow(popup: Popup, memory: PopupMemory, now: Date): boolean {
  const id = String(popup.id);
  switch (popup.frequency) {
    case 'always':
      return true;
    case 'once_per_session':
      return !memory.sessionShown.includes(id);
    case 'once_per_day': {
      const last = memory.shownAt[id];
      return !last || now.getTime() - new Date(last).getTime() >= DAY_MS;
    }
    default:
      return false;
  }
}

export function remember(popup: Popup, memory: PopupMemory, now: Date): PopupMemory {
  const id = String(popup.id);
  return {
    shownAt: { ...memory.shownAt, [id]: now.toISOString() },
    sessionShown: memory.sessionShown.includes(id) ? memory.sessionShown : [...memory.sessionShown, id],
  };
}
