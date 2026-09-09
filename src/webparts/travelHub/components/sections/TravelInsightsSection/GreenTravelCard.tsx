import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Card, ExternalLink, LoadingState, ErrorState, EmptyState, ImageWithFallback } from '../../../../../common/components';
import styles from './TravelInsightsSection.module.scss';

/**
 * Green Travel — one active `TH_GreenTravel` record (ASSUMPTIONS A27): title,
 * description, bullet points, an image with a CSS-only gradient overlay
 * (A28 — the source image is never modified), and an optional link.
 */
export const GreenTravelCard: React.FC = () => {
  const { greenTravel } = useServices();
  const { status, data, retry } = useAsyncData(() => greenTravel.getContent(), []);

  if (status === 'loading') {
    return <LoadingState variant="card" count={1} label="Loading Green Travel" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (data === undefined) {
    return <EmptyState message="Green Travel content isn't available yet." iconName="Leaf" />;
  }

  return (
    // Card always stacks its `media` prop above `children` (vertical) - the
    // mock wants content left / image right (horizontal), so this bypasses
    // that prop and lays both out itself inside Card's plain children slot.
    <Card padding="none" className={styles.greenCard}>
      <div className={styles.greenLayout}>
        <div className={styles.greenBody}>
          <h3 className={styles.greenTitle}>{data.title}</h3>
          <p className={styles.greenDescription}>{data.description}</p>
          {data.points.length > 0 && (
            <ul className={styles.greenPoints}>
              {data.points.map((point, index) => (
                <li key={index}>
                  <Icon iconName="Leaf" aria-hidden="true" /> {point}
                </li>
              ))}
            </ul>
          )}
          {data.linkUrl !== undefined && (
            <ExternalLink href={data.linkUrl} showArrow className={styles.greenLink}>
              {data.linkText ?? 'Learn more'}
            </ExternalLink>
          )}
        </div>

        {data.imageUrl !== undefined && (
          <div className={styles.greenImageWrap}>
            <ImageWithFallback src={data.imageUrl} alt="" aspectRatio="3 / 4" fallbackIcon="Leaf" />
            <div className={styles.greenImageOverlay} aria-hidden="true" />
          </div>
        )}
      </div>
    </Card>
  );
};
