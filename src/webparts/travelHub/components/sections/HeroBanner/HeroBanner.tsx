import * as React from 'react';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../../common/hooks';
import { LoadingState, ErrorState } from '../../../../../common/components';
import { HeroCarousel } from './HeroCarousel';
import { HeroQuickLinks } from './HeroQuickLinks';
import styles from './HeroBanner.module.scss';

/*
 * Frame limits: a very tall (portrait) picture would make the hero taller
 * than the screen, an extreme panorama a thin strip - outside this range the
 * frame stops following the picture and 'cover' crops the overflow. Banner
 * artwork such as 2234 x 704 (3.17:1) is well inside it.
 */
const MIN_AUTO_RATIO = 4 / 3;
const MAX_AUTO_RATIO = 4;

/**
 * Hero section: rotating media (carousel) with the two static quick links and
 * the supporting message overlaid on the bottom of the image. The quick links
 * are deliberately NOT part of the carousel rotation (spec §5).
 */
export const HeroBanner: React.FC = () => {
  const { hero, configuration } = useServices();
  const { status, data, retry } = useAsyncData(() => hero.getContent(configuration), [configuration]);
  const auto = configuration.hero.aspectRatio === 'auto';
  // The frame always takes the SHOWING slide's own shape once it is measured
  // (each slide reports its picture/video size), so every slide fills the
  // hero edge to edge with nothing cropped and no bands - whatever
  // hero.aspectRatio says. That setting (or 3 / 1 - the marketing banner
  // shape - for 'auto') is only the placeholder until the first measurement. Reported: a fixed
  // ratio capped at 78vh cut the left/right of a 3.17:1 banner artwork.
  const [mediaRatio, setMediaRatio] = React.useState<number | undefined>(undefined);
  const onActiveMediaSize = React.useCallback((width: number, height: number): void => {
    if (width > 0 && height > 0) {
      setMediaRatio(Math.min(MAX_AUTO_RATIO, Math.max(MIN_AUTO_RATIO, width / height)));
    }
  }, []);
  const fitsMedia = auto || mediaRatio !== undefined;
  const frameStyle = {
    '--th-hero-ratio': mediaRatio !== undefined ? String(mediaRatio) : auto ? '3 / 1' : configuration.hero.aspectRatio
  } as React.CSSProperties;

  return (
    <section className={styles.root} aria-label="Travel Hub overview">
      {status === 'loading' && <LoadingState variant="hero" label="Loading the travel highlights" />}

      {status === 'error' && (
        <ErrorState message="We couldn’t load the travel highlights. Please try again later." onRetry={retry} />
      )}

      {(status === 'success' || status === 'empty') && data !== undefined && (
        <div className={`${styles.stage} ${fitsMedia ? styles.stageAuto : ''}`} style={frameStyle}>
          {data.slides.length > 0 ? (
            <HeroCarousel
              slides={data.slides}
              autoPlay={configuration.hero.autoPlay}
              intervalSeconds={configuration.hero.intervalSeconds}
              onActiveMediaSize={onActiveMediaSize}
            />
          ) : (
            <div className={styles.fallbackSlide}>
              <div className={styles.slideContent}>
                <h2 className={styles.slideTitle}>{configuration.brandName} Travel Hub</h2>
                <p className={styles.slideText}>
                  Everything you need to plan, manage, and experience travel with confidence — all in one place.
                </p>
              </div>
            </div>
          )}

          {data.quickLinks.length > 0 && (
            <div className={styles.quickLinksOverlay}>
              <HeroQuickLinks
                links={data.quickLinks}
                supportingMessage={data.supportingMessage}
                layout={configuration.hero.quickLinksLayout}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
};
