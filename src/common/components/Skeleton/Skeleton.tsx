import * as React from 'react';
import styles from './Skeleton.module.scss';

export interface ISkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  circle?: boolean;
  className?: string;
}

/** A single shimmering placeholder block. Composed by LoadingState. */
export const Skeleton: React.FC<ISkeletonProps> = ({ width, height, radius, circle, className }) => {
  const style: React.CSSProperties = {
    width: width ?? '100%',
    height: height ?? '1rem',
    borderRadius: circle ? '50%' : radius
  };
  return (
    <span
      className={`${styles.skeleton} ${className ?? ''}`}
      style={style}
      aria-hidden="true"
    />
  );
};
