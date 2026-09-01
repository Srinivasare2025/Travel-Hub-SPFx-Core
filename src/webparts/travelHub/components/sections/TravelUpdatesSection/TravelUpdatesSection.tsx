import * as React from 'react';
import { TravelNewsCard } from './TravelNewsCard';
import { UpcomingEventsCard } from './UpcomingEventsCard';
import { TravelTipsCard } from './TravelTipsCard';
import styles from './TravelUpdatesSection.module.scss';

export interface ITravelUpdatesSectionProps {
  title: string;
}

/**
 * "Travel Updates & Insights" — three independent cards. Each card owns its own
 * data load and loading / empty / error state, so one failing feed never blanks
 * the others.
 */
export const TravelUpdatesSection: React.FC<ITravelUpdatesSectionProps> = ({ title }) => (
  <section className={styles.root} aria-label={title}>
    <h2 className={styles.sectionTitle}>{title}</h2>
    <div className={styles.grid}>
      <TravelNewsCard />
      <UpcomingEventsCard />
      <TravelTipsCard />
    </div>
  </section>
);
