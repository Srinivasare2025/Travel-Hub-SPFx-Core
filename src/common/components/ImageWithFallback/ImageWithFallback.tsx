import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { sanitizeUrl } from '../../utils/urlValidation';
import styles from './ImageWithFallback.module.scss';

export interface IImageWithFallbackProps {
  src: string | undefined;
  /** Optional mobile-optimised source used below the tablet breakpoint. */
  mobileSrc?: string | undefined;
  /** Required. Empty string marks the image decorative. */
  alt: string;
  /** CSS aspect-ratio, e.g. "16 / 9". */
  aspectRatio?: string;
  /** Fallback icon shown when there is no valid src or the image errors. */
  fallbackIcon?: string;
  className?: string;
  eager?: boolean;
}

/**
 * `<img>` with lazy loading, a mobile source, and a graceful fallback. URLs are
 * validated; an invalid src goes straight to the fallback (SECURITY.md §4).
 */
export const ImageWithFallback: React.FC<IImageWithFallbackProps> = ({
  src,
  mobileSrc,
  alt,
  aspectRatio = '16 / 9',
  fallbackIcon = 'Photo2',
  className,
  eager = false
}) => {
  const safeSrc = sanitizeUrl(src);
  const safeMobile = sanitizeUrl(mobileSrc);
  const [errored, setErrored] = React.useState(false);

  const showFallback = safeSrc === undefined || errored;

  return (
    <div className={`${styles.frame} ${className ?? ''}`} style={{ aspectRatio }}>
      {showFallback ? (
        <div className={styles.fallback} aria-hidden={alt === '' ? true : undefined} role={alt === '' ? undefined : 'img'} aria-label={alt === '' ? undefined : alt}>
          <Icon iconName={fallbackIcon} />
        </div>
      ) : (
        <picture>
          {safeMobile !== undefined && <source media="(max-width: 639px)" srcSet={safeMobile} />}
          <img
            className={styles.img}
            src={safeSrc}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setErrored(true)}
          />
        </picture>
      )}
    </div>
  );
};
