import * as React from 'react';
import { IHeroBanner } from '../../../../../models';
import { Carousel, ImageWithFallback } from '../../../../../common/components';
import styles from './HeroBanner.module.scss';

export interface IHeroCarouselProps {
  slides: IHeroBanner[];
  autoPlay: boolean;
  intervalSeconds: number;
}

function HeroSlide({ slide, eager }: { slide: IHeroBanner; eager: boolean }): React.ReactElement {
  return (
    <div className={styles.slide}>
      <div className={styles.slideMedia}>
        {slide.mediaType === 'video' && slide.videoUrl !== undefined ? (
          <video
            className={styles.video}
            src={slide.videoUrl}
            poster={slide.imageUrl}
            muted
            loop
            playsInline
            autoPlay
            aria-label={slide.accessibilityText}
          />
        ) : (
          <ImageWithFallback
            src={slide.imageUrl}
            mobileSrc={slide.mobileImageUrl}
            alt={slide.accessibilityText}
            aspectRatio="21 / 9"
            eager={eager}
            className={styles.image}
          />
        )}
        <div className={styles.scrim} aria-hidden="true" />
      </div>

      {(slide.title.length > 0 || slide.description.length > 0) && (
        <div className={styles.slideContent}>
          {slide.title.length > 0 && <h2 className={styles.slideTitle}>{slide.title}</h2>}
          {slide.description.length > 0 && <p className={styles.slideText}>{slide.description}</p>}
        </div>
      )}
    </div>
  );
}

/** The rotating hero media only. Quick links are rendered separately by HeroBanner. */
export const HeroCarousel: React.FC<IHeroCarouselProps> = ({ slides, autoPlay, intervalSeconds }) => {
  if (slides.length === 1) {
    return <HeroSlide slide={slides[0]} eager />;
  }

  return (
    <Carousel<IHeroBanner>
      items={slides}
      getKey={(s) => s.id}
      visibleCards={{ desktop: 1, tablet: 1, mobile: 1 }}
      ariaLabel="Featured travel highlights"
      autoPlay={autoPlay}
      intervalMs={Math.max(3, intervalSeconds) * 1000}
      loop
      showArrows
      showDots
      controlsPosition="overlay"
      renderItem={(slide, index) => <HeroSlide slide={slide} eager={index === 0} />}
    />
  );
};
