import * as React from 'react';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../../common/hooks';
import {
  Carousel,
  SectionHeader,
  LoadingState,
  EmptyState,
  ErrorState
} from '../../../../../common/components';
import { ITravelService } from '../../../../../models';
import { TravelServiceCard } from './TravelServiceCard';
import styles from './TravelServicesCarousel.module.scss';

export interface ITravelServicesCarouselProps {
  title: string;
}

/** "Explore Our Travel Services" — a carousel of dynamic service cards. */
export const TravelServicesCarousel: React.FC<ITravelServicesCarouselProps> = ({ title }) => {
  const { travelServices, configuration } = useServices();
  const { status, data, retry } = useAsyncData(
    () => travelServices.getServices(configuration),
    [configuration]
  );

  const visibleCards = React.useMemo(
    () => ({
      desktop: configuration.services.desktopVisibleCards,
      tablet: configuration.services.tabletVisibleCards,
      mobile: configuration.services.mobileVisibleCards
    }),
    [configuration.services]
  );

  return (
    <section className={styles.root} aria-labelledby="th-services-heading">
      <SectionHeader title={title} headingLevel={2} id="th-services-heading" />

      {status === 'loading' && <LoadingState variant="carousel" count={visibleCards.desktop} label={`Loading ${title}`} />}

      {status === 'empty' && <EmptyState message="No travel services are currently available." iconName="Airplane" />}

      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && data !== undefined && (
        <Carousel<ITravelService>
          items={data}
          getKey={(s) => s.id}
          visibleCards={visibleCards}
          ariaLabel={title}
          renderItem={(service) => <TravelServiceCard service={service} />}
        />
      )}
    </section>
  );
};
