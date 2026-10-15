import * as React from 'react';
import { parseImageHints, toHighResImageUrl } from '../../utils/imageHints';
import styles from './ImageWithFallback.module.scss';

export interface IFitImgProps {
  /** Already-validated URL (list services run `sanitizeUrl`), optionally with `#focus=`/`#fit=` hints. */
  src: string;
  alt?: string;
  className?: string;
  /** Crop focus when the URL carries no `#focus=` hint, e.g. "center 30%" for banners. */
  position?: string;
  /** Default fit when the URL carries no `#fit=` hint. */
  fit?: 'cover' | 'contain';
  eager?: boolean;
  /**
   * Allow the blurred fill behind a `contain` picture (default true). Pass
   * false for small inline images (QR codes, logos in a split card) - they
   * have no clipping frame, and the absolutely positioned backdrop would
   * otherwise spread over the whole page body.
   */
  backdrop?: boolean;
}

/**
 * A plain `<img>` for card/banner frames that size themselves in CSS (the
 * frame's class positions the image absolutely), honouring the editor's
 * `#focus=` / `#fit=` hints (common/utils/imageHints.ts) and asking for the
 * full-size rendition of thumbnail links. With fit = contain a blurred copy
 * fills the spare space, so a logo or poster never leaves empty bars.
 */
export const FitImg: React.FC<IFitImgProps> = ({ src, alt = '', className, position, fit, eager = false, backdrop = true }) => {
  const imgRef = React.useRef<HTMLImageElement>(null);
  // The blurred backdrop is absolutely positioned, so it is only safe inside
  // a frame that is positioned AND clips, with the picture itself filling
  // that frame. A small inline image (the QR code in a split card) has no
  // such frame - there the backdrop escaped and covered the whole page body.
  const [inClippingFrame, setInClippingFrame] = React.useState(false);
  const hints = parseImageHints(src);
  const effectiveFit = hints?.fit ?? fit;

  React.useLayoutEffect(() => {
    const img = imgRef.current;
    const frame = img?.parentElement;
    if (!backdrop || effectiveFit !== 'contain' || img === null || frame === null || frame === undefined) {
      setInClippingFrame(false);
      return;
    }
    const imgStyle = window.getComputedStyle(img);
    const frameStyle = window.getComputedStyle(frame);
    const clips = (v: string): boolean => v === 'hidden' || v === 'clip';
    setInClippingFrame(
      imgStyle.position === 'absolute' &&
        frameStyle.position !== 'static' &&
        clips(frameStyle.overflowX) &&
        clips(frameStyle.overflowY)
    );
  }, [backdrop, effectiveFit, className]);

  if (hints === undefined || hints.src.length === 0) {
    return null;
  }
  const url = toHighResImageUrl(hints.src);
  const objectPosition = hints.position ?? position;
  const style: React.CSSProperties = {};
  if (effectiveFit === 'contain') {
    style.objectFit = 'contain';
  }
  if (objectPosition !== undefined) {
    style.objectPosition = objectPosition;
  }
  // Same element tree whether or not the backdrop shows, so the main picture
  // is never remounted (and re-downloaded) when the frame check flips it on.
  return (
    <>
      {backdrop && effectiveFit === 'contain' && inClippingFrame && (
        <img className={styles.backdrop} src={url} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      )}
      <img
        ref={imgRef}
        className={className}
        style={style}
        src={url}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </>
  );
};

/** CSS `background-position` for a hinted background image (page heroes, closing banners). */
export function backgroundFor(src: string, fallbackPosition: string): { url: string; position: string; size: 'cover' | 'contain' } {
  const hints = parseImageHints(src);
  return {
    url: toHighResImageUrl(hints?.src ?? src),
    position: hints?.position ?? fallbackPosition,
    size: hints?.fit === 'contain' ? 'contain' : 'cover'
  };
}
