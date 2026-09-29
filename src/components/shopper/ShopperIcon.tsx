import type { SVGProps } from 'react';

/** Icons for shopper features that the shared Icon set does not have (yet). */
export type ShopperIconName = 'bell' | 'compare' | 'heartFilled';

const PATHS: Record<ShopperIconName, string> = {
  bell: 'M19 16v-5a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Zm-2 1H7v-6a5 5 0 0 1 10 0v6Zm-5 5a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z',
  compare: 'M7 3 2.5 7.5 7 12V8.5h8v-2H7V3Zm10 9v3.5H9v2h8V21l4.5-4.5L17 12Z',
  heartFilled: 'M12 20.6 4.3 13A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 7.7 7L12 20.6Z',
};

interface ShopperIconProps extends SVGProps<SVGSVGElement> {
  name: ShopperIconName;
  size?: number;
}

export function ShopperIcon({ name, size = 24, ...rest }: ShopperIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d={PATHS[name]} fillRule="evenodd" />
    </svg>
  );
}
