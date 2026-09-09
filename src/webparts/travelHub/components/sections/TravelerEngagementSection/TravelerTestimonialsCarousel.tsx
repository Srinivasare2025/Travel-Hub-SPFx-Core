import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Carousel, SectionHeader, Badge, LoadingState, EmptyState, ErrorState, ImageWithFallback } from '../../../../../common/components';
import { ITravelerTestimonial } from '../../../../../models';
import { StarRating } from './TestimonialShared';
import styles from './TravelerEngagementSection.module.scss';

function TestimonialCard({ item }: { item: ITravelerTestimonial }): React.ReactElement {
  return (
    <article className={styles.testimonialCard}>
      <ImageWithFallback
        src={item.profileImageUrl}
        alt=""
        aspectRatio="1 / 1"
        className={styles.testimonialAvatar}
        fallbackIcon="Contact"
      />
      <div className={styles.testimonialBody}>
        {item.category !== undefined && (
          <Badge text={item.category} tone="gold" />
        )}
        <StarRating rating={item.rating} />
        <p className={styles.testimonialComment}>{item.comment}</p>
        <div className={styles.testimonialName}>{item.personName}</div>
        {item.personInfoLine !== undefined && <div className={styles.testimonialInfo}>{item.personInfoLine}</div>}
      </div>
    </article>
  );
}

/** "What Our Travellers Say" — a carousel of testimonial cards. */
export const TravelerTestimonialsCarousel: React.FC = () => {
  const { testimonials, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => testimonials.getTestimonials(configuration), [configuration]);

  const visibleCards = React.useMemo(
    () => ({
      desktop: configuration.testimonials.desktopVisibleCards,
      tablet: configuration.testimonials.tabletVisibleCards,
      mobile: configuration.testimonials.mobileVisibleCards
    }),
    [configuration.testimonials]
  );

  const title = 'What Our Travellers Say';

  return (
    <div className={styles.testimonials}>
      <SectionHeader
        title={title}
        headingLevel={3}
        actions={
          <button type="button" className={styles.viewAllStories} onClick={() => navigate({ kind: 'testimonialsAll' })}>
            View All Stories <Icon iconName="ChevronRight" aria-hidden="true" />
          </button>
        }
      />

      {status === 'loading' && <LoadingState variant="carousel" count={visibleCards.desktop} label={`Loading ${title}`} />}
      {status === 'empty' && <EmptyState message="No traveller stories are available yet." iconName="Comment" />}
      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && data !== undefined && (
        <Carousel<ITravelerTestimonial>
          items={data}
          getKey={(t) => t.id}
          visibleCards={visibleCards}
          ariaLabel={title}
          autoPlay={configuration.testimonials.autoPlay}
          intervalMs={Math.max(3, configuration.testimonials.intervalSeconds) * 1000}
          loop
          renderItem={(item) => <TestimonialCard item={item} />}
        />
      )}
    </div>
  );
};
