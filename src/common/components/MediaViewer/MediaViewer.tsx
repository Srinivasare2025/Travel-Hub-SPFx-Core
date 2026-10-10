import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { Modal } from '../Modal';
import type { IMediaItem } from '../../utils/mediaItems';
import styles from './MediaViewer.module.scss';

export interface IMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Dialog name, shown in the top bar, e.g. "City Guide (Riyadh & Jeddah)". */
  title: string;
  items: IMediaItem[];
  /** Item shown first (e.g. the gallery photo that was clicked). */
  startIndex?: number;
}

/**
 * In-app popup for card content that is a file rather than a page: one or
 * more PDFs / documents (each an `<iframe>`, switched with tabs - e.g. a City
 * Guide's "Riyadh | Jeddah"), or a set of photos (prev/next, arrow keys and
 * thumbnails - e.g. a catering setup gallery). Like `ImageLightbox`, the file
 * never replaces the Travel Hub page in the address bar; "Open in new tab"
 * is the fallback for a browser/library that won't display a file inline.
 */
export const MediaViewer: React.FC<IMediaViewerProps> = ({ isOpen, onClose, title, items, startIndex = 0 }) => {
  const [index, setIndex] = React.useState(startIndex);
  const allImages = items.length > 0 && items.every((item) => item.kind === 'image');
  const count = items.length;

  React.useEffect(() => {
    if (isOpen) {
      setIndex(Math.min(Math.max(startIndex, 0), Math.max(count - 1, 0)));
    }
  }, [isOpen, startIndex, count]);

  const step = React.useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  React.useEffect(() => {
    if (!isOpen || !allImages || count < 2) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        step(-1);
      } else if (event.key === 'ArrowRight') {
        step(1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, allImages, count, step]);

  const current = items[index] ?? items[0];
  if (current === undefined) {
    return null;
  }
  const currentLabel = current.label.length > 0 ? current.label : title;

  return (
    <Modal isOpen={isOpen} onDismiss={onClose} title={title} hideHeader size="fullscreen">
      <div className={styles.topBar}>
        <span className={styles.title}>{title}</span>
        {!allImages && count > 1 && (
          <div className={styles.tabs} role="tablist" aria-label={title}>
            {items.map((item, i) => (
              <button
                key={`${item.url}-${String(i)}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={`${styles.tab} ${i === index ? styles.tabActive : ''}`}
                onClick={() => setIndex(i)}
              >
                <Icon iconName={item.kind === 'image' ? 'Photo2' : 'PDF'} aria-hidden="true" />
                {item.label.length > 0 ? item.label : `Document ${String(i + 1)}`}
              </button>
            ))}
          </div>
        )}
        <a className={styles.openLink} href={current.url} target="_blank" rel="noopener noreferrer">
          <Icon iconName="OpenInNewWindow" aria-hidden="true" /> Open in new tab
        </a>
      </div>

      <div className={styles.stage}>
        {current.kind === 'image' ? (
          <img className={styles.image} src={current.url} alt={currentLabel} />
        ) : (
          // key: switching tabs loads the new document instead of reusing the frame's history.
          <iframe key={current.url} className={styles.frame} src={current.url} title={currentLabel} />
        )}
        {allImages && count > 1 && (
          <>
            <button type="button" className={`${styles.nav} ${styles.navPrev}`} onClick={() => step(-1)} aria-label="Previous image">
              <Icon iconName="ChevronLeft" aria-hidden="true" />
            </button>
            <button type="button" className={`${styles.nav} ${styles.navNext}`} onClick={() => step(1)} aria-label="Next image">
              <Icon iconName="ChevronRight" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {allImages && (
        <div className={styles.footer}>
          <span className={styles.caption} aria-live="polite">
            {current.label}
            {count > 1 && <span className={styles.counter}>{`${String(index + 1)} / ${String(count)}`}</span>}
          </span>
          {count > 1 && (
            <div className={styles.thumbs}>
              {items.map((item, i) => (
                <button
                  key={`${item.url}-${String(i)}`}
                  type="button"
                  className={`${styles.thumb} ${i === index ? styles.thumbActive : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={item.label.length > 0 ? item.label : `Image ${String(i + 1)}`}
                  aria-current={i === index ? 'true' : undefined}
                >
                  <img src={item.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
