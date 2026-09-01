import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './EmptyState.module.scss';

export interface IEmptyStateProps {
  message: string;
  iconName?: string;
  action?: React.ReactNode;
}

/** Friendly "nothing here yet" panel. Never leave a blank area (spec §23). */
export const EmptyState: React.FC<IEmptyStateProps> = ({ message, iconName = 'Inbox', action }) => (
  <div className={styles.root} role="status">
    <Icon iconName={iconName} className={styles.icon} aria-hidden="true" />
    <p className={styles.message}>{message}</p>
    {action !== undefined && <div className={styles.action}>{action}</div>}
  </div>
);
