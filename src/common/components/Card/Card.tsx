import * as React from 'react';
import styles from './Card.module.scss';

export interface ICardProps {
  /** Optional media slot rendered above the body (image, etc.). */
  media?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Adds hover elevation; use when the whole card is a link target. */
  interactive?: boolean;
  as?: 'div' | 'article' | 'li';
  className?: string;
  children: React.ReactNode;
}

/** Standard surface: border, radius, shadow. Business cards compose this. */
export const Card: React.FC<ICardProps> = ({
  media,
  padding = 'md',
  interactive = false,
  as = 'div',
  className,
  children
}) => {
  const Tag = as;
  const padClass =
    padding === 'none'
      ? styles.padNone
      : padding === 'sm'
        ? styles.padSm
        : padding === 'lg'
          ? styles.padLg
          : styles.padMd;
  return (
    <Tag
      className={`${styles.card} ${interactive ? styles.interactive : ''} ${className ?? ''}`}
    >
      {media !== undefined && <div className={styles.media}>{media}</div>}
      <div className={`${styles.body} ${padClass}`}>{children}</div>
    </Tag>
  );
};
