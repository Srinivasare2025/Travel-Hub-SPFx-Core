import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Badge, Button, LoadingState, EmptyState, ErrorState, ImageWithFallback } from '../../../../../common/components';
import { ITravelerTestimonial } from '../../../../../models';
import { StarRating } from './TestimonialShared';
import styles from './TravelerEngagementSection.module.scss';

function FeedbackCard({ item }: { item: ITravelerTestimonial }): React.ReactElement {
  return (
    <article className={styles.feedbackCard}>
      {item.category !== undefined && <Badge text={item.category} tone="gold" />}
      <div className={styles.feedbackPerson}>
        <ImageWithFallback
          src={item.profileImageUrl}
          alt=""
          aspectRatio="1 / 1"
          className={styles.feedbackAvatar}
          fallbackIcon="Contact"
        />
        <div>
          <div className={styles.testimonialName}>{item.personName}</div>
          <StarRating rating={item.rating} />
        </div>
      </div>
      <p className={styles.feedbackComment}>{item.comment}</p>
      {item.department !== undefined && <div className={styles.feedbackDepartment}>{item.department}</div>}
    </article>
  );
}

/**
 * "View All Traveler Feedback" — every active testimonial (not just the
 * carousel's page), reached from the carousel's "View All Stories" link.
 * "Submit Feedback" at the bottom opens `SubmitFeedbackScreen`.
 */
export const ViewAllFeedbackScreen: React.FC = () => {
  const { testimonials, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => testimonials.getTestimonials(configuration), [configuration]);

  return (
    <div className={`${styles.screen} ${styles.screenWide}`}>
      <button type="button" className={styles.screenBack} onClick={() => navigate({ kind: 'hub' })}>
        <Icon iconName="Back" aria-hidden="true" /> Back to Travel Hub
      </button>

      <h1 className={styles.screenTitle}>What Our Travellers Say</h1>

      {status === 'loading' && <LoadingState variant="grid" count={6} label="Loading traveller feedback" />}
      {status === 'error' && <ErrorState onRetry={retry} />}
      {status === 'empty' && <EmptyState message="No traveller stories are available yet." iconName="Comment" />}

      {status === 'success' && data !== undefined && (
        <div className={styles.feedbackGrid}>
          {data.map((item) => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className={styles.feedbackSubmitRow}>
        <Button variant="primary" onClick={() => navigate({ kind: 'testimonialsSubmit' })}>
          Submit Feedback
        </Button>
      </div>
    </div>
  );
};
