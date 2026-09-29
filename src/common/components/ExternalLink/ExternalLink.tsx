import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { sanitizeUrl } from '../../utils/urlValidation';
import styles from './ExternalLink.module.scss';

export interface IExternalLinkProps {
  href: string | undefined;
  openInNewTab?: boolean;
  /** Show a trailing arrow (used by "Learn More" style links). */
  showArrow?: boolean;
  className?: string;
  ariaLabel?: string;
  /**
   * In-app navigation instead of a URL (e.g. a card CTA that opens a
   * `NavigationContext` screen) — renders a `<button>` with identical
   * styling instead of an `<a>`. Ignored when `href` is a valid URL; `href`
   * wins if both are given.
   */
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * The only link component for editor-supplied URLs. Re-validates the URL at
 * render time and, when opening a new tab, always sets rel="noopener noreferrer"
 * (SECURITY.md §4). An invalid/missing URL renders as inert text, unless
 * `onClick` is given (in-app navigation) — see `onClick` above.
 */
export const ExternalLink: React.FC<IExternalLinkProps> = ({
  href,
  openInNewTab = false,
  showArrow = false,
  className,
  ariaLabel,
  onClick,
  children
}) => {
  const safeHref = sanitizeUrl(href);
  const cls = `${styles.link} ${className ?? ''}`;

  const inner = (
    <>
      <span>{children}</span>
      {showArrow && <Icon iconName="ChevronRight" className={styles.arrow} aria-hidden="true" />}
    </>
  );

  if (safeHref === undefined && onClick !== undefined) {
    return (
      <button type="button" className={cls} aria-label={ariaLabel} onClick={onClick}>
        {inner}
      </button>
    );
  }

  if (safeHref === undefined) {
    return (
      <span className={`${cls} ${styles.inert}`} aria-disabled="true">
        {inner}
      </span>
    );
  }

  return (
    <a
      className={cls}
      href={safeHref}
      aria-label={ariaLabel}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
    >
      {inner}
    </a>
  );
};
