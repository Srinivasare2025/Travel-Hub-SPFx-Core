import { useEffect, useState } from 'react';
import { IResponsive } from '../../models';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const TABLET_MIN = 640;
const DESKTOP_MIN = 1024;

function current(): Breakpoint {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  const w = window.innerWidth;
  if (w >= DESKTOP_MIN) {
    return 'desktop';
  }
  if (w >= TABLET_MIN) {
    return 'tablet';
  }
  return 'mobile';
}

/** Current breakpoint, updated on resize (debounced via rAF). */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(current);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    let frame = 0;
    const onResize = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBp(current()));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return bp;
}

/** Pick the value for the current breakpoint from a responsive triple. */
export function useResponsiveValue<T>(value: IResponsive<T>): T {
  const bp = useBreakpoint();
  return value[bp];
}
