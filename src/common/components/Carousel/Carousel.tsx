import * as React from 'react';
import { IResponsive } from '../../../models';
import { useCarousel } from '../../hooks/useCarousel';
import { useResponsiveValue } from '../../hooks/useBreakpoint';
import { IconButton } from '../IconButton';
import styles from './Carousel.module.scss';

export interface ICarouselProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string | number;
  /** Cards visible per page, by breakpoint. */
  visibleCards: IResponsive<number>;
  ariaLabel: string;
  autoPlay?: boolean;
  intervalMs?: number;
  loop?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  /** 'below' (default) puts controls under the track; 'overlay' pins them over the bottom of the track (full-bleed heroes). */
  controlsPosition?: 'below' | 'overlay';
}

/**
 * The single carousel implementation (ARCHITECTURE.md — no second slider).
 * Accessible: labelled region, arrow-key paging, pause on hover/focus/tab-hidden/
 * reduced-motion, polite live region on page change.
 */
export function Carousel<T>(props: ICarouselProps<T>): React.ReactElement {
  const {
    items,
    renderItem,
    getKey,
    visibleCards,
    ariaLabel,
    autoPlay = false,
    intervalMs = 6000,
    loop = true,
    showArrows = true,
    showDots = true,
    controlsPosition = 'below'
  } = props;

  const visibleCount = Math.max(1, useResponsiveValue(visibleCards));
  const { page, pageCount, next, prev, goTo, atStart, atEnd, pauseHandlers } = useCarousel({
    itemCount: items.length,
    visibleCount,
    autoPlay,
    intervalMs,
    loop
  });

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
    } else if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      goTo(pageCount - 1);
    }
  };

  const showControls = pageCount > 1;

  return (
    <section
      className={styles.root}
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      {...pauseHandlers}
    >
      <div className={styles.viewport}>
        <ul
          className={styles.track}
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {items.map((item, index) => (
            <li className={styles.slide} key={getKey(item, index)} style={{ flexBasis: `calc(100% / ${visibleCount})` }}>
              {renderItem(item, index)}
            </li>
          ))}
        </ul>
      </div>

      <span className={styles.srStatus} aria-live="polite">
        {showControls ? `Item group ${page + 1} of ${pageCount}` : ''}
      </span>

      {showControls && (showArrows || showDots) && (
        <div className={`${styles.controls} ${controlsPosition === 'overlay' ? styles.controlsOverlay : ''}`}>
          {showArrows && (
            <IconButton
              icon="ChevronLeft"
              ariaLabel="Previous items"
              onClick={prev}
              disabled={!loop && atStart}
              size="sm"
            />
          )}

          {showDots && (
            <div className={styles.dots} role="tablist" aria-label={`${ariaLabel} pagination`}>
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === page}
                  aria-label={`Go to item group ${i + 1}`}
                  className={`${styles.dot} ${i === page ? styles.dotActive : ''}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}

          {showArrows && (
            <IconButton
              icon="ChevronRight"
              ariaLabel="Next items"
              onClick={next}
              disabled={!loop && atEnd}
              size="sm"
            />
          )}
        </div>
      )}
    </section>
  );
}
