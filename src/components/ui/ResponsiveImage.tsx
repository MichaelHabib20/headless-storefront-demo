import type { ResponsiveImage as ResponsiveImageData } from '@/sdk';

interface ResponsiveImageProps {
  image: ResponsiveImageData;
  className?: string;
  /** First screenful images load eagerly for a fast first paint. */
  priority?: boolean;
  fallbackAlt?: string;
}

/** Desktop and mobile artwork from the backend, chosen by the browser. */
export function ResponsiveImage({ image, className, priority, fallbackAlt = '' }: ResponsiveImageProps) {
  return (
    <picture>
      {image.desktop !== image.mobile && <source media="(min-width: 768px)" srcSet={image.desktop} />}
      <img
        src={image.mobile}
        alt={image.alt ?? fallbackAlt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    </picture>
  );
}
