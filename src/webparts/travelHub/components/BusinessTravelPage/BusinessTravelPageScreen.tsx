import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { Button, ExternalLink, LoadingState, ErrorState, EmptyState } from '../../../../common/components';
import { IBusinessTravelInfoCard, IBusinessTravelStep } from '../../../../models';
import styles from './BusinessTravelPageScreen.module.scss';

/** The 5-card "Raise Request → Approval → Book → Travel → Expense" process row. */
const StepsGrid: React.FC = () => {
  const { businessTravel } = useServices();
  const { status, data, retry } = useAsyncData(() => businessTravel.getSteps(), []);

  if (status === 'loading') {
    return <LoadingState variant="grid" count={5} label="Loading Business Travel steps" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (status === 'empty' || data === undefined) {
    return <EmptyState message="No Business Travel steps are configured yet." iconName="TaskList" />;
  }

  return (
    <div className={styles.stepsGrid}>
      {data.map((step: IBusinessTravelStep) => (
        <div key={step.id} className={styles.stepCard}>
          <span className={styles.stepNumber} style={{ backgroundColor: step.backgroundColor }} aria-hidden="true">
            {step.number}
          </span>
          <h3 className={styles.stepTitle}>{step.title}</h3>
          <p className={styles.stepDescription}>{step.description}</p>
        </div>
      ))}
    </div>
  );
};

/** The 3-card "Policy reminders / Useful Documents / Need further help?" row. */
const InfoCardsGrid: React.FC = () => {
  const { businessTravel } = useServices();
  const { status, data, retry } = useAsyncData(() => businessTravel.getInfoCards(), []);

  if (status === 'loading') {
    return <LoadingState variant="grid" count={3} label="Loading Business Travel information" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (status === 'empty' || data === undefined) {
    return <EmptyState message="No additional information is configured yet." iconName="Info" />;
  }

  return (
    <div className={styles.infoGrid}>
      {data.map((card: IBusinessTravelInfoCard) => (
        <div key={card.id} className={styles.infoCard}>
          <h3 className={styles.infoTitle}>{card.title}</h3>
          <p className={styles.infoDescription}>{card.description}</p>
          {card.linkUrl !== undefined && (
            <ExternalLink href={card.linkUrl} openInNewTab={card.openInNewTab} showArrow>
              {card.linkText}
            </ExternalLink>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * The dedicated "Business Travel" page (`NavigationContext`'s `businessTravel`
 * view): title/description + an "Access SAP Concur" CTA
 * (`configuration.businessTravel`), the 5-step request-to-expense process
 * (`TH_BusinessTravelSteps`), and 3 supporting info cards
 * (`TH_BusinessTravelInfoCards`). Reached from the "Business Travel" service
 * card and its matching global nav tab (GlobalNavigationService.ts,
 * TravelServiceCard.tsx).
 */
export const BusinessTravelPageScreen: React.FC = () => {
  const { configuration } = useServices();
  const { navigate } = useNavigation();
  const { title, description, concurUrl, concurLinkText, concurOpenInNewTab } = configuration.businessTravel;

  return (
    <div className={styles.screen}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate({ kind: 'hub' })}>
          Home
        </button>
        <Icon iconName="ChevronRight" aria-hidden="true" />
        <span aria-current="page">{title}</span>
      </nav>

      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        {concurUrl !== undefined && (
          <Button variant="primary" href={concurUrl} openInNewTab={concurOpenInNewTab} iconAfter="ChevronRight">
            {concurLinkText}
          </Button>
        )}
      </div>

      <StepsGrid />
      <InfoCardsGrid />
    </div>
  );
};
