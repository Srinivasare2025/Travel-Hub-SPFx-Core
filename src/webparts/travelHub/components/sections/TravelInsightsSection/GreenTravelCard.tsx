import * as React from 'react';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
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
  const { navigate } = useNavigation();
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
          {data.subtitle !== undefined && <p className={styles.greenSubtitle}>{data.subtitle}</p>}
          <p className={styles.greenDescription}>{data.description}</p>
          {data.linkUrl !== undefined ? (
            // An external LinkUrl configured on TH_GreenTravel - always opens
            // in a new window/tab so travelers don't lose the Hub.
            <ExternalLink href={data.linkUrl} openInNewTab showArrow className={styles.greenLink}>
              {data.linkText ?? 'Explore Green Travel'}
            </ExternalLink>
          ) : (
            // No external link configured - fall back to the in-app detail
            // page (GreenTravelDetailScreen) instead of hiding the action.
            <ExternalLink href={undefined} onClick={() => navigate({ kind: 'greenTravel' })} showArrow className={styles.greenLink}>
              {data.linkText ?? 'Explore Green Travel'}
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
