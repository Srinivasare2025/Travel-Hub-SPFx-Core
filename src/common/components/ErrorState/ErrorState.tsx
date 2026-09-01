import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { Button } from '../Button';
import styles from './ErrorState.module.scss';

export interface IErrorStateProps {
  /** 'error' = load failure with retry; 'forbidden' = access denied (no retry). */
  variant?: 'error' | 'forbidden';
  message?: string;
  onRetry?: () => void;
  /** Optional extra action, e.g. a "View Travel Dashboard" link for the forbidden variant. */
  action?: React.ReactNode;
}

const DEFAULTS = {
  error: 'We couldn’t load this section. Please try again later.',
  forbidden: 'You don’t have access to this content.'
};

/** Friendly failure / access-denied panel. Replaces blank areas on failure (spec §23). */
export const ErrorState: React.FC<IErrorStateProps> = ({ variant = 'error', message, onRetry, action }) => (
  <div className={`${styles.root} ${styles[variant]}`} role="alert">
    <Icon
      iconName={variant === 'forbidden' ? 'Lock' : 'Error'}
      className={styles.icon}
      aria-hidden="true"
    />
    <p className={styles.message}>{message ?? DEFAULTS[variant]}</p>
    <div className={styles.actions}>
      {variant === 'error' && onRetry !== undefined && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
      {action}
    </div>
  </div>
);
