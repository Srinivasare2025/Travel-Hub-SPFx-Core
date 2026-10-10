import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Button, LoadingState, ErrorState, EmptyState } from '../../../../../common/components';
import { PageHero } from '../../PolicyPages/PolicyPageScreen';
import { parseGreenPoint } from './parseGreenPoint';
import styles from './GreenTravelDetailScreen.module.scss';

/**
 * Full-width "Green Travel" detail page — reached from the home page card's
 * "Explore Green Travel" action when no external `LinkUrl` is configured on
 * `TH_GreenTravel` (an internal link). Reuses the same content the card
 * shows; a dedicated screen so there's somewhere to grow richer content
 * later without changing the card or its data shape.
 */
export const GreenTravelDetailScreen: React.FC = () => {
  const { greenTravel } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => greenTravel.getContent(), []);

  if (status === 'loading') {
    return <LoadingState variant="hero" label="Loading Green Travel" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (data === undefined) {
    return (
      <EmptyState
        message="Green Travel content isn't available yet."
        iconName="Leaf"
        action={
          <Button variant="secondary" onClick={() => navigate({ kind: 'hub' })}>
            Back to Travel Hub
          </Button>
        }
      />
    );
  }

  return (
    <div className={styles.screen}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate({ kind: 'hub' })}>
          Home
        </button>
        <Icon iconName="ChevronRight" aria-hidden="true" />
        <span aria-current="page">{data.title}</span>
      </nav>

      {/* Same banner as every Travel Hub page (title, text, photo on the right). */}
      <PageHero
        hero={{
          icon: undefined,
          eyebrow: 'Green Travel',
          title: data.title,
          subtitle: data.subtitle,
          description: data.description.length > 0 ? data.description : undefined,
          imageUrl: data.imageUrl,
          tagline: undefined,
          style: 'light',
          links: [],
          logoUrl: undefined,
          highlights: []
        }}
      />

      {data.points.length > 0 && (
        <ol className={styles.points}>
          {data.points.map((point, index) => {
            const parsed = parseGreenPoint(point);
            return (
              <li key={index} className={styles.pointItem}>
                <span className={styles.pointNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.pointBody}>
                  {parsed.heading !== undefined && <strong className={styles.pointHeading}>{parsed.heading}: </strong>}
                  {parsed.text}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
