import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { ITravelService } from '../../../../../models';
import { Card, ImageWithFallback, ExternalLink } from '../../../../../common/components';
import styles from './TravelServicesCarousel.module.scss';

export interface ITravelServiceCardProps {
  service: ITravelService;
}

const TravelServiceCardInner: React.FC<ITravelServiceCardProps> = ({ service }) => (
  <Card
    as="article"
    padding="md"
    interactive={service.linkUrl !== undefined}
    className={styles.card}
    media={
      <div className={styles.mediaWrap}>
        <ImageWithFallback src={service.imageUrl} alt="" aspectRatio="16 / 10" />
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
    {service.linkUrl !== undefined && (
      <div className={styles.action}>
        <ExternalLink
          href={service.linkUrl}
          openInNewTab={service.openInNewTab}
          showArrow
          ariaLabel={`${service.linkText}: ${service.title}`}
        >
          {service.linkText}
        </ExternalLink>
      </div>
    )}
  </Card>
);

/** Memoised — rendered many times inside the carousel with stable props. */
export const TravelServiceCard = React.memo(TravelServiceCardInner);
