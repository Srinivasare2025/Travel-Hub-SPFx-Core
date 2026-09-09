import * as React from 'react';
import { SectionHeader } from '../../../../../common/components';
import { QuickPulseCard } from './QuickPulseCard';
import { TravelerTestimonialsCarousel } from './TravelerTestimonialsCarousel';
import styles from './TravelerEngagementSection.module.scss';

export interface ITravelerEngagementSectionProps {
  title: string;
}

/**
 * "Traveler Engagement" — Quick Pulse + testimonials, two columns
 * (COMPONENTS.md §3.4): Quick Pulse in a narrower column, the testimonials
 * carousel in a wider one since it needs room for 3 cards on desktop
 * (`testimonials.desktopVisibleCards`). Stacks to one column below desktop.
 *
 * Both columns start with the same `SectionHeader` (title only on the Quick
 * Pulse side, title + "View All Stories" on the testimonials side) so the
 * two cards line up at the same vertical position instead of the
 * testimonials' own header row pushing its cards lower than Quick Pulse's.
 */
export const TravelerEngagementSection: React.FC<ITravelerEngagementSectionProps> = ({ title }) => (
  <section className={styles.root} aria-label={title}>
    <h2 className={styles.sectionTitle}>{title}</h2>
    <div className={styles.grid}>
      <div>
        <SectionHeader title="Quick Pulse" headingLevel={3} />
        <QuickPulseCard />
      </div>
      <TravelerTestimonialsCarousel />
    </div>
  </section>
);
