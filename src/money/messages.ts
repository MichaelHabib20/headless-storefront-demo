import type { Locale } from '@/sdk';

interface PriceLabels {
  /** Read before the price the shopper pays, when there is an old price. */
  now: string;
  /** Read before the old (struck-through) price. */
  was: string;
}

/** Screen-reader labels of a discounted price. Never shown on screen. */
const MESSAGES: Record<Locale, PriceLabels> = {
  en: { now: 'Now', was: 'Was' },
  ar: { now: 'السعر الحالي', was: 'السعر قبل الخصم' },
};

export function priceLabels(locale: Locale): PriceLabels {
  return MESSAGES[locale] ?? MESSAGES.en;
}

export const messagesForTest = MESSAGES;
