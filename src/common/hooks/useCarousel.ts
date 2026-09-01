import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export interface IUseCarouselOptions {
  itemCount: number;
  visibleCount: number;
  autoPlay: boolean;
  intervalMs: number;
  loop?: boolean;
}

export interface IUseCarousel {
  page: number;
  pageCount: number;
  atStart: boolean;
  atEnd: boolean;
  isPaused: boolean;
  next: () => void;
  prev: () => void;
  goTo: (page: number) => void;
  /** Spread on the track wrapper: pauses autoplay on hover / focus. */
  pauseHandlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocusCapture: () => void;
    onBlurCapture: () => void;
  };
}

/**
 * Headless carousel state: paging, autoplay with pause-on-hover / pause-on-focus
 * / pause-on-tab-hidden / pause-on-reduced-motion, clamped or looping navigation.
 * The visual Carousel component owns keyboard handling and rendering.
 */
export function useCarousel(options: IUseCarouselOptions): IUseCarousel {
  const { itemCount, visibleCount, autoPlay, intervalMs, loop = true } = options;
  const reducedMotion = useReducedMotion();

  const pageCount = Math.max(1, Math.ceil(itemCount / Math.max(1, visibleCount)));
  const [page, setPage] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  // Ref mirror so the autoplay interval always sees the latest page without re-subscribing.
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Keep the page valid if inputs change (e.g. viewport resize changes visibleCount).
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    const onVisibility = (): void => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      setPage((current) => {
        if (loop) {
          return (target + pageCount) % pageCount;
        }
        return Math.min(Math.max(target, 0), pageCount - 1);
      });
    },
    [loop, pageCount]
  );

  const next = useCallback(() => goTo(pageRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(pageRef.current - 1), [goTo]);

  const isPaused = hoverPaused || focusPaused || tabHidden || reducedMotion || !autoPlay;

  useEffect(() => {
    if (isPaused || pageCount <= 1 || intervalMs <= 0) {
      return undefined;
    }
    const id = window.setInterval(() => {
      goTo(pageRef.current + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isPaused, pageCount, intervalMs, goTo]);

  const pauseHandlers = useMemo(
    () => ({
      onMouseEnter: () => setHoverPaused(true),
      onMouseLeave: () => setHoverPaused(false),
      onFocusCapture: () => setFocusPaused(true),
      onBlurCapture: () => setFocusPaused(false)
    }),
    []
  );

  return {
    page,
    pageCount,
    atStart: page === 0,
    atEnd: page === pageCount - 1,
    isPaused,
    next,
    prev,
    goTo,
    pauseHandlers
  };
}
