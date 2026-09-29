'use client';

import type { MouseEvent, ReactNode } from 'react';
import type { BoundAction } from './helpers';

interface OpenMarksReadProps {
  /** Bound "mark as read" server action; undefined when the notification is already read. */
  onOpen?: BoundAction;
  className?: string;
  children: ReactNode;
}

/**
 * Opening a notification's link (click, Enter, ctrl/middle click) marks it as read.
 * Runs in the capture phase so the request starts before the link navigates; the
 * navigation is never blocked or delayed.
 */
export function OpenMarksRead({ onOpen, className, children }: OpenMarksReadProps) {
  function opened(event: MouseEvent<HTMLDivElement>) {
    if (!onOpen) return;
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return;
    onOpen().catch(() => undefined);
  }

  return (
    <div className={className} onClickCapture={opened} onAuxClickCapture={opened}>
      {children}
    </div>
  );
}
