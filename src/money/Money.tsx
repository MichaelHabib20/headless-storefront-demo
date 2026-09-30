import type { Money as MoneyValue } from '@/sdk';

/** Elements a money text can be drawn as. */
export type MoneyTag = 'span' | 'strong' | 'b' | 'em' | 'p' | 'div' | 'dd' | 'td' | 'th' | 'li';

export interface MoneyProps {
  /** A `Money` from the API. `null` (e.g. no cart discount) renders nothing. */
  value: MoneyValue | null | undefined;
  /** The element to render. Default `span`. */
  as?: MoneyTag;
  className?: string;
  'data-testid'?: string;
}

/**
 * An amount exactly as the backend wrote it (`display`: already in the shopper's language,
 * digits and currency). Nothing is formatted or computed here.
 */
export function Money({ value, as: Tag = 'span', className, 'data-testid': testId }: MoneyProps) {
  if (!value) return null;
  return (
    <Tag className={className} data-testid={testId}>
      {value.display}
    </Tag>
  );
}
