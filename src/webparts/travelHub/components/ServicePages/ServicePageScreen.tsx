import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { Button, ImageWithFallback, LoadingState, ErrorState, EmptyState } from '../../../../common/components';
import styles from './ServicePageScreen.module.scss';

export interface IServicePageScreenProps {
  serviceId: number;
}

/**
 * A placeholder landing page for one "Explore Our Travel Services" tile
 * (Personal Travel Offers, SAP Concur, Catering Services, Meetings & Events,
 * Expense Claim, …), reached from `GlobalNav`. Reuses that service's own
 * title/description/icon/image — there is no dedicated content or layout for
 * these pages yet ("future we will decide content and layout" per the
 * business); this exists so the nav tab goes to a real page instead of a
 * dead `#` link, with the service's own action link (if any) as a CTA.
 * Travel Policy and Business Travel are each their own real page
 * (`PolicyPageScreen`, `BusinessTravelPageScreen`), not this.
 */
export const ServicePageScreen: React.FC<IServicePageScreenProps> = ({ serviceId }) => {
  const { travelServices, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => travelServices.getServices(configuration), [configuration]);

  const service = data?.find((s) => s.id === serviceId);

  return (
    <div className={styles.screen}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate({ kind: 'hub' })}>
          Home
        </button>
        <Icon iconName="ChevronRight" aria-hidden="true" />
        <span aria-current="page">{service?.title ?? 'Travel Service'}</span>
      </nav>

      {status === 'loading' && <LoadingState variant="hero" label="Loading" />}
      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && service === undefined && (
        <EmptyState
          message="This travel service isn't available."
          iconName="Page"
          action={
            <Button variant="secondary" onClick={() => navigate({ kind: 'hub' })}>
              Back to Travel Hub
            </Button>
          }
        />
      )}

      {status === 'success' && service !== undefined && (
        <>
          <div className={styles.header}>
            <span className={styles.icon} style={{ backgroundColor: service.iconBackgroundColor }} aria-hidden="true">
              <Icon iconName={service.icon} />
            </span>
            <h1 className={styles.title}>{service.title}</h1>
          </div>

          {service.imageUrl !== undefined && (
            <ImageWithFallback
              src={service.imageUrl}
              alt=""
              aspectRatio="21 / 9"
              fit={service.imageFit}
              className={styles.image}
            />
          )}

          <p className={styles.description}>{service.description}</p>

          <div className={styles.comingSoon}>
            <Icon iconName="Info" aria-hidden="true" />
            <p>More detailed content and a dedicated layout for this page are coming soon.</p>
          </div>

          {service.linkUrl !== undefined && (
            <div className={styles.action}>
              <Button variant="primary" href={service.linkUrl} openInNewTab={service.openInNewTab} iconAfter="ChevronRight">
                {service.linkText}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
