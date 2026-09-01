import * as React from 'react';
import styles from './Badge.module.scss';

export type BadgeTone = 'gold' | 'navy' | 'muted' | 'alert';

export interface IBadgeProps {
  text: string;
  tone?: BadgeTone;
}

/** Small status / category pill. Text is always present so meaning is never colour-only (spec §20). */
export const Badge: React.FC<IBadgeProps> = ({ text, tone = 'muted' }) => (
  <span className={`${styles.badge} ${styles[tone]}`}>{text}</span>
);
