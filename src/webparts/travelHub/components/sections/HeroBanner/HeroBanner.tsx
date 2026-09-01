import * as React from 'react';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../../common/hooks';
import { LoadingState, ErrorState } from '../../../../../common/components';
import { HeroCarousel } from './HeroCarousel';
import { HeroQuickLinks } from './HeroQuickLinks';
import styles from './HeroBanner.module.scss';

/**
 * Hero section: rotating media (carousel) with the two static quick links and
 * the supporting message overlaid on the bottom of the image. The quick links
 * are deliberately NOT part of the carousel rotation (spec §5).
 */
export const HeroBanner: React.FC = () => {
  const { hero, configuration } = useServices();
  const { status, data, retry } = useAsyncData(() => hero.getContent(configuration), [configuration]);

  return (
    <section className={styles.root} aria-label="Travel Hub overview">
      {status === 'loading' && <LoadingState variant="hero" label="Loading the travel highlights" />}

      {status === 'error' && (
        <ErrorState message="We couldn’t load the travel highlights. Please try again later." onRetry={retry} />
      )}

      {(status === 'success' || status === 'empty') && data !== undefined && (
        <div className={styles.stage}>
          {data.slides.length > 0 ? (
            <HeroCarousel
              slides={data.slides}
              autoPlay={configuration.hero.autoPlay}
              intervalSeconds={configuration.hero.intervalSeconds}
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
