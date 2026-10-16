'use client';

import { useEffect, useRef, useState } from 'react';

interface StoreLogoProps {
  /** `Layout.store.logo`; null → the store name as text. */
  src: string | null | undefined;
  name: string | null | undefined;
  imageClassName?: string;
  textClassName?: string;
}

/**
 * The store logo in the header. When the file is missing (404) or the API sent none, the store name
 * is shown as text instead of the browser's broken-image icon. A logo that already failed before the
 * page became interactive is caught on mount (`complete` with no size), like `ProductImage`.
 */
export function StoreLogo({ src, name, imageClassName, textClassName }: StoreLogoProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (src && img && img.complete && img.naturalWidth === 0 && img.currentSrc) setFailed(src);
  }, [src]);

  if (!src || failed === src) {
    return (
      <span className={textClassName} data-testid="store-logo-text">
        {name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- merchant logo from any CDN
    <img ref={ref} src={src} alt={name ?? ''} className={imageClassName} onError={() => setFailed(src)} data-testid="store-logo" />
  );
}
