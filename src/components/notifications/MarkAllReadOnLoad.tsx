'use client';

import { useEffect } from 'react';
import type { BoundAction } from './helpers';

interface MarkAllReadOnLoadProps {
  /** The "mark all as read" server action, already bound to the locale. */
  markAllRead: BoundAction;
}

/** Store owner request: marks every notification as read as soon as the page opens. */
export function MarkAllReadOnLoad({ markAllRead }: MarkAllReadOnLoadProps) {
  useEffect(() => {
    markAllRead().catch(() => undefined);
  }, [markAllRead]);

  return null;
}
