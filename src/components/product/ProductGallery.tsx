'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type { Image, Locale, ProductVideo } from '@/sdk';
import { formatNumber } from '@/lib/numbers';
import { Icon } from '../ui/Icon';
import { fillTemplate, safeVideoUrl } from './details';
import styles from './ProductGallery.module.css';

export interface ProductGalleryLabels {
  /** Accessible name of the thumbnails, e.g. "Product images". */
  gallery: string;
  /** With `{n}` and `{total}`: "Image 2 of 4". */
  imageOf: string;
  video: string;
  playVideo: string;
  previous: string;
  next: string;
}

interface ProductGalleryProps {
  /** `gallery` from the API: main image first. */
  images: Image[];
  video: ProductVideo | null;
  /** Alt text for images the API sent without one. */
  name: string;
  labels: ProductGalleryLabels;
  locale: Locale;
}

type Slide = { kind: 'image'; image: Image } | { kind: 'video'; video: ProductVideo };

/** Play triangle (the shared icon set has none). */
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

/**
 * Product pictures in the order the backend sent them, then the video. Thumbnails are buttons:
 * click, or use the arrow keys / Home / End on them. The video opens in a new tab: the API gives
 * its address, not whether it is a file or a player page.
 */
export function ProductGallery({ images, video, name, labels, locale }: ProductGalleryProps) {
  const slides: Slide[] = [...images.map((image): Slide => ({ kind: 'image', image })), ...(video ? [{ kind: 'video', video } as Slide] : [])];
  const [index, setIndex] = useState(0);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = slides[Math.min(index, slides.length - 1)];
  const count = slides.length;
  const thumbLabel = (i: number) => fillTemplate(labels.imageOf, { n: formatNumber(i + 1, locale), total: formatNumber(count, locale) });

  function select(next: number, focus = false) {
    const bounded = Math.min(Math.max(next, 0), count - 1);
    setIndex(bounded);
    if (focus) thumbs.current[bounded]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const moves: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
      ArrowDown: 1,
      ArrowUp: -1,
    };
    if (event.key in moves) select(index + moves[event.key], true);
    else if (event.key === 'Home') select(0, true);
    else if (event.key === 'End') select(count - 1, true);
    else return;
    event.preventDefault();
  }

  return (
    <div className={styles.gallery} data-testid="product-gallery">
      <div className={styles.stage}>
        {!current ? (
          <div className={styles.placeholder} aria-hidden="true" />
        ) : current.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
          <img src={current.image.url} alt={current.image.alt ?? name} className={styles.image} data-testid="product-gallery-image" />
        ) : (
          <VideoStage video={current.video} labels={labels} />
        )}

        {count > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.previous}`} aria-label={labels.previous} disabled={index === 0} onClick={() => select(index - 1)}>
              <Icon name="chevron" size={20} className={styles.back} />
            </button>
            <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={labels.next} disabled={index === count - 1} onClick={() => select(index + 1)}>
              <Icon name="chevron" size={20} directional />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className={styles.thumbs} aria-label={labels.gallery}>
          {slides.map((slide, i) => (
            <li key={i}>
              <button
                type="button"
                ref={(element) => {
                  thumbs.current[i] = element;
                }}
                className={styles.thumb}
                aria-label={slide.kind === 'video' ? labels.video : thumbLabel(i)}
                aria-current={i === index ? 'true' : undefined}
                tabIndex={i === index ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={onKeyDown}
              >
                {slide.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                  <img src={slide.image.url} alt="" loading="lazy" decoding="async" className={styles.thumbImage} />
                ) : (
                  <span className={styles.videoThumb}>
                    {slide.video.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                      <img src={slide.video.thumbnail} alt="" loading="lazy" decoding="async" className={styles.thumbImage} />
                    )}
                    <span className={styles.play}>
                      <PlayIcon />
                    </span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VideoStage({ video, labels }: { video: ProductVideo; labels: ProductGalleryLabels }) {
  const url = safeVideoUrl(video.url);
  return (
    <div className={styles.videoStage} data-testid="product-video">
      {video.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
        <img src={video.thumbnail} alt="" className={styles.image} />
      ) : (
        <div className={styles.placeholder} aria-hidden="true" />
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.playLink}>
          <PlayIcon />
          <span>{labels.playVideo}</span>
        </a>
      )}
    </div>
  );
}
