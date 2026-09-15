import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { ITravelService } from '../../../../../models';
import { Card, ImageWithFallback, ExternalLink } from '../../../../../common/components';
import styles from './TravelServicesCarousel.module.scss';

export interface ITravelServiceCardProps {
  service: ITravelService;
}

/** The "Business Travel" card opens the dedicated in-app page instead of its own (placeholder) `linkUrl` - see GlobalNavigationService.ts for the matching nav-tab special-case. */
function isBusinessTravel(service: ITravelService): boolean {
  return service.title.trim().toLowerCase() === 'business travel';
}

const TravelServiceCardInner: React.FC<ITravelServiceCardProps> = ({ service }) => {
  const { navigate } = useNavigation();
  const businessTravel = isBusinessTravel(service);
  const hasAction = businessTravel || service.linkUrl !== undefined;

  return (
    <Card
      as="article"
      padding="md"
      interactive={hasAction}
      className={styles.card}
      media={
        <div className={styles.mediaWrap}>
          <ImageWithFallback src={service.imageUrl} alt="" aspectRatio="16 / 10" fit={service.imageFit} />
          <span
            className={styles.iconChip}
            style={{ backgroundColor: service.iconBackgroundColor }}
            aria-hidden="true"
          >
            <Icon iconName={service.icon} />
          </span>
        </div>
      }
    >
      <h3 className={styles.title}>{service.title}</h3>
      <p className={styles.description}>{service.description}</p>
      {hasAction && (
        <div className={styles.action}>
          <ExternalLink
            href={businessTravel ? undefined : service.linkUrl}
            openInNewTab={service.openInNewTab}
            showArrow
            ariaLabel={`${service.linkText}: ${service.title}`}
            onClick={businessTravel ? () => navigate({ kind: 'businessTravel' }) : undefined}
          >
            {service.linkText}
          </ExternalLink>
        </div>
      )}
    </Card>
  );
};

/** Memoised — rendered many times inside the carousel with stable props. */
export const TravelServiceCard = React.memo(TravelServiceCardInner);
