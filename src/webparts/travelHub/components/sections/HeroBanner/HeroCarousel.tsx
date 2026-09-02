import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { IHeroBanner } from '../../../../../models';
import { Carousel, ImageWithFallback, IconButton } from '../../../../../common/components';
import type { ICarouselRenderHelpers } from '../../../../../common/components';
import { sanitizeUrl } from '../../../../../common/utils/urlValidation';
import styles from './HeroBanner.module.scss';

export interface IHeroCarouselProps {
  slides: IHeroBanner[];
  autoPlay: boolean;
  intervalSeconds: number;
}

interface IHeroSlideProps {
  slide: IHeroBanner;
  eager: boolean;
  /** Video slides only: whether this is the currently-showing slide. Undefined for the single-slide (non-carousel) case, which is always active. */
  isActive?: boolean;
  /** Video slides only: called once the video finishes playing, to advance the carousel. */
  onVideoEnded?: () => void;
  /** Video slides only: suspend/resume the carousel's own autoplay timer while this video plays. */
  setSuspended?: (suspended: boolean) => void;
}

function HeroVideo({
  slide,
  isActive,
  onVideoEnded,
  setSuspended
}: {
  slide: IHeroBanner;
  isActive: boolean;
  onVideoEnded?: () => void;
  setSuspended?: (suspended: boolean) => void;
}): React.ReactElement {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = React.useState(true);
  const watchFullHref = sanitizeUrl(slide.videoUrl);

  // Only the active slide actually plays — every slide is mounted at once
  // (the carousel just translates the track), so without this every video
  // would start playing off-screen. Suspend the carousel's own auto-advance
  // timer for as long as this video is active and playing, so a >30s video
  // isn't cut off — it advances itself via onEnded instead.
  React.useEffect(() => {
    const video = videoRef.current;
    if (video === null) {
      return undefined;
    }
    if (isActive) {
      setSuspended?.(true);
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          /* Autoplay can be blocked even when muted in rare cases; the poster stays visible. */
        });
      }
    } else {
      video.pause();
      setSuspended?.(false);
    }
    return () => setSuspended?.(false);
  }, [isActive, setSuspended]);

  const handleEnded = (): void => {
    setSuspended?.(false);
    onVideoEnded?.();
  };

  return (
    <>
      <video
        ref={videoRef}
        className={styles.video}
        src={slide.videoUrl}
        poster={slide.imageUrl}
        muted={muted}
        playsInline
        aria-label={slide.accessibilityText}
        onEnded={handleEnded}
      />
      <div className={styles.videoControls}>
        <IconButton
          icon={muted ? 'Volume0' : 'Volume3'}
          ariaLabel={muted ? 'Unmute video' : 'Mute video'}
          onClick={() => setMuted((m) => !m)}
          size="sm"
          tone="onImage"
        />
        {watchFullHref !== undefined && (
          <a
            className={styles.videoWatchFull}
            href={watchFullHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Watch the full video: ${slide.title || slide.accessibilityText}`}
          >
            <Icon iconName="OpenInNewWindow" aria-hidden="true" /> Watch full video
          </a>
        )}
      </div>
    </>
  );
}

function HeroSlide({ slide, eager, isActive = true, onVideoEnded, setSuspended }: IHeroSlideProps): React.ReactElement {
  return (
    <div className={styles.slide}>
      <div className={styles.slideMedia}>
        {slide.mediaType === 'video' && slide.videoUrl !== undefined ? (
          <HeroVideo slide={slide} isActive={isActive} onVideoEnded={onVideoEnded} setSuspended={setSuspended} />
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
      renderItem={(slide, index, { isActive, next, setSuspended }: ICarouselRenderHelpers) => (
        <HeroSlide
          slide={slide}
          eager={index === 0}
          isActive={isActive}
          onVideoEnded={next}
          setSuspended={setSuspended}
        />
      )}
    />
  );
};
