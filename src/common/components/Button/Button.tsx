import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { sanitizeUrl } from '../../utils/urlValidation';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface IButtonProps {
  variant?: ButtonVariant;
  onClick?: () => void;
  /** When set the button renders as an anchor. URL is validated; an invalid URL disables the control. */
  href?: string;
  openInNewTab?: boolean;
  disabled?: boolean;
  /** Fluent icon name shown after the label (e.g. a chevron). */
  iconAfter?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
  children: React.ReactNode;
}

/** The single button implementation. Business components never re-style native buttons. */
export const Button: React.FC<IButtonProps> = ({
  variant = 'primary',
  onClick,
  href,
  openInNewTab = false,
  disabled = false,
  iconAfter,
  ariaLabel,
  type = 'button',
  children
}) => {
  const className = `${styles.button} ${styles[variant]}`;
  const safeHref = href !== undefined ? sanitizeUrl(href) : undefined;

  const content = (
    <>
      <span className={styles.label}>{children}</span>
      {iconAfter !== undefined && <Icon iconName={iconAfter} className={styles.icon} aria-hidden="true" />}
    </>
  );

  if (href !== undefined && safeHref !== undefined && !disabled) {
    return (
      <a
        className={className}
        href={safeHref}
        aria-label={ariaLabel}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={className}
      type={type}
      onClick={onClick}
      disabled={disabled || (href !== undefined && safeHref === undefined)}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
};
