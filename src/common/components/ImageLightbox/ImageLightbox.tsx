import * as React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { sanitizeUrl } from '../../utils/urlValidation';
import styles from './ImageLightbox.module.scss';

export interface IImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string | undefined;
  alt: string;
  /** Accessible dialog name; falls back to `alt`. */
  title?: string;
}

/**
 * Views an image inside the app (e.g. a Travel Care poster with QR codes) rather
 * than navigating the browser to the raw file URL. The file URL is only ever an
 * `<img src>`, never the address bar, so viewers are not dropped into the
 * document library.
 */
export const ImageLightbox: React.FC<IImageLightboxProps> = ({ isOpen, onClose, src, alt, title }) => {
  const [zoomed, setZoomed] = React.useState(false);
  const safe = sanitizeUrl(src);

  React.useEffect(() => {
    if (!isOpen) {
      setZoomed(false);
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen && safe !== undefined} onDismiss={onClose} title={title ?? alt} hideHeader size="fullscreen">
      <div className={styles.frame}>
        {safe !== undefined && (
          <img
            className={`${styles.image} ${zoomed ? styles.zoomed : ''}`}
            src={safe}
            alt={alt}
          />
        )}
      </div>
      <div className={styles.toolbar}>
        <span className={styles.caption}>{alt}</span>
        <Button variant="secondary" onClick={() => setZoomed((z) => !z)}>
          {zoomed ? 'Fit to screen' : 'Actual size'}
        </Button>
      </div>
    </Modal>
  );
};
