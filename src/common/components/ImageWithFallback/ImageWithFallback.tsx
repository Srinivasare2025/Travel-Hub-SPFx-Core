import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { sanitizeUrl } from '../../utils/urlValidation';
import { parseImageHints, toHighResImageUrl } from '../../utils/imageHints';
import styles from './ImageWithFallback.module.scss';

export interface IImageWithFallbackProps {
  src: string | undefined;
  /** Optional mobile-optimised source used below the tablet breakpoint. */
  mobileSrc?: string | undefined;
  /** Required. Empty string marks the image decorative. */
  alt: string;
  /** CSS aspect-ratio, e.g. "16 / 9". `undefined` lets the caller's class size the frame. */
  aspectRatio?: string | undefined;
  /** Fallback icon shown when there is no valid src or the image errors. */
  fallbackIcon?: string;
  /**
   * `cover` (default) crops to fill the frame - right for full-bleed
   * photography. `contain` shows the whole image uncropped (logos, posters),
   * filling the spare space with a blurred copy of the same picture. `fill`
   * stretches the image - avoid; kept only for backwards compatibility.
   * An editor's `#fit=` hint on the URL (imageHints.ts) wins over this.
   */
  fit?: 'cover' | 'contain' | 'fill';
  /**
   * Default focal point (CSS object-position) when the URL has no `#focus=`
   * hint, e.g. "center 25%" for portraits so faces are not cropped.
   */
  position?: string;
  className?: string;
  eager?: boolean;
  /** Called with the loaded picture's own pixel size (e.g. the hero frame sizes itself to it). */
  onNaturalSize?: (width: number, height: number) => void;
}

/**
 * `<img>` with lazy loading, a mobile source, and a graceful fallback. URLs are
 * validated; an invalid src goes straight to the fallback (SECURITY.md §4).
 *
 * Sizing: the frame owns the size (aspect-ratio or the caller's class) and the
 * picture is absolutely positioned inside it, so an image's own pixel size can
 * never make one card taller than its neighbours - any photo, any shape, the
 * same frame. Thumbnail links are upgraded to the full-size rendition
 * (`toHighResImageUrl`) so photos stay sharp.
 */
export const ImageWithFallback: React.FC<IImageWithFallbackProps> = ({
  src,
  mobileSrc,
  alt,
  aspectRatio = '16 / 9',
  fallbackIcon = 'Photo2',
  fit = 'cover',
  position,
  className,
  eager = false,
  onNaturalSize
}) => {
  const hints = parseImageHints(sanitizeUrl(src));
  const mobileHints = parseImageHints(sanitizeUrl(mobileSrc));
  const [errored, setErrored] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const safeSrc = hints !== undefined && hints.src.length > 0 ? toHighResImageUrl(hints.src) : undefined;
  const safeMobile = mobileHints !== undefined && mobileHints.src.length > 0 ? toHighResImageUrl(mobileHints.src) : undefined;

  // A new src (e.g. the admin replaced the photo) gets a fresh chance to load.
  React.useEffect(() => setErrored(false), [safeSrc]);

  // A picture served from the browser cache can finish loading before React
  // is listening, so `onLoad` never fires - report its size from here too.
  React.useEffect(() => {
    const img = imgRef.current;
    if (onNaturalSize !== undefined && img !== null && img.complete && img.naturalWidth > 0) {
      onNaturalSize(img.naturalWidth, img.naturalHeight);
    }
  }, [safeSrc, onNaturalSize]);

  const showFallback = safeSrc === undefined || errored;
  const effectiveFit = hints?.fit ?? fit;
  const objectPosition = hints?.position ?? position;
  const imgStyle: React.CSSProperties = {};
  if (effectiveFit !== 'cover') {
    imgStyle.objectFit = effectiveFit;
  }
  if (objectPosition !== undefined) {
    imgStyle.objectPosition = objectPosition;
  }

  return (
    <div className={`${styles.frame} ${className ?? ''}`} style={aspectRatio !== undefined ? { aspectRatio } : undefined}>
      {showFallback ? (
        <div className={styles.fallback} aria-hidden={alt === '' ? true : undefined} role={alt === '' ? undefined : 'img'} aria-label={alt === '' ? undefined : alt}>
          <Icon iconName={fallbackIcon} />
        </div>
      ) : (
        <>
          {effectiveFit === 'contain' && (
            // Soft backdrop so a letterboxed logo/poster never shows empty bars.
            <img className={styles.backdrop} src={safeSrc} alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" />
          )}
          <picture>
            {safeMobile !== undefined && <source media="(max-width: 639px)" srcSet={safeMobile} />}
            <img
              ref={imgRef}
              className={styles.img}
              style={imgStyle}
              src={safeSrc}
              alt={alt}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setErrored(true)}
              onLoad={
                onNaturalSize === undefined
                  ? undefined
                  : (e) => onNaturalSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
              }
            />
          </picture>
        </>
      )}
    </div>
  );
};
