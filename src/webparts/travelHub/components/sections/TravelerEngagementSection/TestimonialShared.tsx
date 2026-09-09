import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './TravelerEngagementSection.module.scss';

/** Shared 1–5 star display, used by both the carousel card and `ViewAllFeedbackScreen`. */
export const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className={styles.stars} role="img" aria-label={`${rating} out of 5 stars`}>
      {stars.map((star) => (
        <Icon key={star} iconName={star <= rating ? 'FavoriteStarFill' : 'FavoriteStar'} aria-hidden="true" />
      ))}
    </span>
  );
};
