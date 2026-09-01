import * as React from 'react';
import { IconButton } from '../IconButton';
import styles from './Modal.module.scss';

export interface IModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  /** Used as the accessible name; shown in the header unless `hideHeader`. */
  title: string;
  hideHeader?: boolean;
  size?: 'md' | 'lg' | 'fullscreen';
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus trap, ESC to close, backdrop click, body-scroll lock,
 * focus restored on close. Rendered in place (inside `.travelHub`) so the design
 * tokens still apply — no portal.
 */
export const Modal: React.FC<IModalProps> = ({
  isOpen,
  onDismiss,
  title,
  hideHeader = false,
  size = 'md',
  children
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const returnFocusTo = React.useRef<HTMLElement | undefined>(undefined);

  React.useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    returnFocusTo.current = (document.activeElement as HTMLElement | null) ?? undefined;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    const node = dialogRef.current;
    const initial = node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab' || node === null) {
        return;
      }
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus();
    };
  }, [isOpen, onDismiss]);

  if (!isOpen) {
    return null;
  }

  const onOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      onDismiss();
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={onOverlayMouseDown}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        {hideHeader ? (
          <div className={styles.floatingClose}>
            <IconButton icon="Cancel" ariaLabel="Close" onClick={onDismiss} tone="onImage" />
          </div>
        ) : (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <IconButton icon="Cancel" ariaLabel="Close" onClick={onDismiss} size="sm" />
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
};
