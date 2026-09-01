import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './IconButton.module.scss';

export interface IIconButtonProps {
  icon: string;
  /** Required — icon-only controls must be labelled for screen readers. */
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  tone?: 'default' | 'onImage';
}

/** Icon-only control (carousel prev/next, modal close). */
export const IconButton: React.FC<IIconButtonProps> = ({
  icon,
  ariaLabel,
  onClick,
  disabled = false,
  size = 'md',
  tone = 'default'
}) => (
  <button
    type="button"
    className={`${styles.button} ${size === 'sm' ? styles.sm : styles.md} ${
      tone === 'onImage' ? styles.onImage : ''
    }`}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    <Icon iconName={icon} aria-hidden="true" />
  </button>
);
