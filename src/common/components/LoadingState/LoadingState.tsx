import * as React from 'react';
import { Skeleton } from '../Skeleton';
import styles from './LoadingState.module.scss';

export type LoadingVariant = 'carousel' | 'list' | 'card' | 'hero' | 'grid' | 'rows';

export interface ILoadingStateProps {
  variant: LoadingVariant;
  count?: number;
  /** Accessible label announced to screen readers while loading. */
  label?: string;
}

/**
 * Skeleton placeholder shaped to the final layout so nothing shifts when data
 * arrives (PERFORMANCE.md — CLS budget). One per dynamic section.
 */
export const LoadingState: React.FC<ILoadingStateProps> = ({ variant, count = 3, label }) => {
  const items = Array.from({ length: Math.max(1, count) });
  return (
    <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>{label ?? 'Loading…'}</span>

      {variant === 'hero' && <Skeleton height="clamp(280px, 42vw, 460px)" radius="var(--full-radius-lg, 16px)" />}

      {variant === 'carousel' && (
        <div className={styles.carousel}>
          {items.map((_, i) => (
            <div key={i} className={styles.card} aria-hidden="true">
              <Skeleton height="150px" radius="var(--full-radius-md, 8px)" />
              <Skeleton width="70%" height="1.1rem" />
              <Skeleton width="100%" height="0.8rem" />
              <Skeleton width="40%" height="0.8rem" />
            </div>
          ))}
        </div>
      )}

      {(variant === 'grid' || variant === 'card') && (
        <div className={styles.grid}>
          {items.map((_, i) => (
            <div key={i} className={styles.card} aria-hidden="true">
              <Skeleton height="140px" radius="var(--full-radius-md, 8px)" />
              <Skeleton width="60%" height="1.1rem" />
              <Skeleton width="90%" height="0.8rem" />
            </div>
          ))}
        </div>
      )}

      {(variant === 'list' || variant === 'rows') && (
        <div className={styles.list}>
          {items.map((_, i) => (
            <div key={i} className={styles.row} aria-hidden="true">
              <Skeleton width="64px" height="64px" radius="var(--full-radius-md, 8px)" />
              <div className={styles.rowText}>
                <Skeleton width="55%" height="1rem" />
                <Skeleton width="85%" height="0.8rem" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
