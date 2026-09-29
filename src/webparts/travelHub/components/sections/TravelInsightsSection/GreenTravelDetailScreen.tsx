import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Button, LoadingState, ErrorState, EmptyState, ImageWithFallback } from '../../../../../common/components';
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

      {data.imageUrl !== undefined && (
        <div className={styles.hero}>
          <ImageWithFallback src={data.imageUrl} alt="" aspectRatio="21 / 9" fallbackIcon="Leaf" />
        </div>
      )}

      <h1 className={styles.title}>{data.title}</h1>
      {data.subtitle !== undefined && <p className={styles.subtitle}>{data.subtitle}</p>}
      <p className={styles.description}>{data.description}</p>

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
