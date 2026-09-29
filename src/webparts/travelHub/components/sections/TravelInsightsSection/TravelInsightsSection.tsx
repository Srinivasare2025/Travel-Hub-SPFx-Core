import * as React from 'react';
import { DepartmentTravelSpendCard } from './DepartmentTravelSpendCard';
import { GreenTravelCard } from './GreenTravelCard';
import styles from './TravelInsightsSection.module.scss';

export interface ITravelInsightsSectionProps {
  title: string;
}

/** "Travel Insights" — Department Travel Spend + Green Travel, side by side. */
export const TravelInsightsSection: React.FC<ITravelInsightsSectionProps> = ({ title }) => (
  <section className={styles.root} aria-label={title}>
    <h2 className={styles.sectionTitle}>{title}</h2>
    <div className={styles.grid}>
      <DepartmentTravelSpendCard />
      <GreenTravelCard />
    </div>
  </section>
);
