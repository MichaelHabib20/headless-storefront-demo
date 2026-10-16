'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The store's "no picture" image (the old storefront's placeholder: a framed landscape), inline so
 * it needs no request and works on every store and host.
 */
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" fill="none" stroke="#8a8a8a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">' +
      '<rect x="22" y="14" width="116" height="92" rx="4"/><rect x="32" y="24" width="96" height="72"/>' +
      '<circle cx="54" cy="42" r="7"/><path d="M32 86l26-26 20 22"/><path d="M66 70l26-30 36 40"/><path d="M58 96c22-10 46-14 70-14"/></svg>',
  );

interface ProductImageProps {
  /** The picture's address from the API; null → the placeholder. */
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  'data-testid'?: string;
}

/**
 * A product picture that shows the store's placeholder instead of the browser's broken-image icon
 * when the file is missing (404) or the API sent none. A picture that already failed before the
 * page became interactive is caught on mount (`complete` with no size).
 */
export function ProductImage({ src, alt, className, loading = 'lazy', 'data-testid': testId }: ProductImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  const broken = !src || failed === src;

  useEffect(() => {
    const img = ref.current;
    if (src && img && img.complete && img.naturalWidth === 0 && img.currentSrc) setFailed(src);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
    <img
      ref={ref}
      src={broken ? PLACEHOLDER_IMAGE : src}
      alt={broken && !src ? '' : alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => {
        if (src) setFailed(src);
      }}
      data-placeholder={broken || undefined}
      data-testid={testId}
    />
  );
}
