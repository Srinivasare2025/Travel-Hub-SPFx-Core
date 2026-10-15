import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Card, ExternalLink, LoadingState, ErrorState, EmptyState, ImageWithFallback } from '../../../../../common/components';
import { parseGreenPoint } from './parseGreenPoint';
import styles from './TravelInsightsSection.module.scss';

/** At most this many Points show on the card as chips; the full list lives on the detail page. */
const CARD_POINTS = 3;

/**
 * Green Travel — one active `TH_GreenTravel` record (ASSUMPTIONS A27).
 *
 * Reported: the card showed a lot of empty space because it takes the height
 * of the taller Department Travel Spend card next to it. The photo now fills
 * the WHOLE card and the text sits over its lower part on a CSS gradient (A28
 * — the source image is never modified), so whatever height the row needs is
 * filled by the picture, and both Insights cards stay the same height. Up to
 * three Points show as chips.
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

  const chips = data.points
    .map((line) => parseGreenPoint(line))
    .map((point) => point.heading ?? point.text)
    .filter((text) => text.length > 0)
    .slice(0, CARD_POINTS);

  return (
    <Card padding="none" className={`${styles.greenCard} ${data.imageUrl === undefined ? styles.greenCardNoImage : ''}`}>
      <div className={styles.greenLayout}>
        {data.imageUrl !== undefined && (
          <div className={styles.greenImageWrap} aria-hidden="true">
            <ImageWithFallback src={data.imageUrl} alt="" aspectRatio={undefined} fallbackIcon="Leaf" />
            <div className={styles.greenImageOverlay} />
          </div>
        )}
        <div className={styles.greenBody}>
          <span className={styles.greenEyebrow}>
            <Icon iconName="Leaf" aria-hidden="true" /> Sustainability
          </span>
          <h3 className={styles.greenTitle}>{data.title}</h3>
          {data.subtitle !== undefined && <p className={styles.greenSubtitle}>{data.subtitle}</p>}
          {data.description.length > 0 && <p className={styles.greenDescription}>{data.description}</p>}
          {chips.length > 0 && (
            <ul className={styles.greenChips}>
              {chips.map((chip) => (
                <li key={chip} className={styles.greenChip}>
                  <Icon iconName="CheckMark" aria-hidden="true" /> {chip}
                </li>
              ))}
            </ul>
          )}
          {data.linkUrl !== undefined ? (
            // An external LinkUrl configured on TH_GreenTravel - always opens
            // in a new window/tab so travelers don't lose the Hub.
            <ExternalLink href={data.linkUrl} openInNewTab showArrow className={styles.greenLink}>
              {data.linkText ?? 'Explore Green Travel'}
            </ExternalLink>
          ) : (
            // No external link configured - the in-app detail page (GreenTravelDetailScreen).
            <ExternalLink href={undefined} onClick={() => navigate({ kind: 'greenTravel' })} showArrow className={styles.greenLink}>
              {data.linkText ?? 'Explore Green Travel'}
            </ExternalLink>
          )}
        </div>
      </div>
    </Card>
  );
};
