import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Button, LoadingState, ErrorState, EmptyState } from '../../../../../common/components';
import { ITravelSpend, ITravelSpendAccess } from '../../../../../models';
import styles from './TravelSpendDetailScreen.module.scss';

interface ISpendResult {
  access: ITravelSpendAccess;
  spend: ITravelSpend | undefined;
}

/**
 * Full-width "Department Travel Spend" detail page — the same Power BI
 * report the home page card previews at a compact size (DepartmentTravelSpendCard's
 * "View Detailed" action), shown here full width/tall. Access is re-checked
 * the same way as the card (SECURITY.md §3): the UI is never the security
 * boundary, so a denial here shows no figures and no report, same as the card.
 */
export const TravelSpendDetailScreen: React.FC = () => {
  const { spend, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData<ISpendResult>(async () => {
    const access = await spend.getAccess(configuration);
    if (!access.hasAccess) {
      return { access, spend: undefined };
    }
    return { access, spend: await spend.getSpend(configuration) };
  }, [configuration]);

  if (status === 'loading') {
    return <LoadingState variant="hero" label="Loading travel spend" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (data === undefined || !data.access.hasAccess || data.spend === undefined) {
    return (
      <EmptyState
        message={data?.access.hasAccess === false ? configuration.spend.deniedMessage : 'No travel spend figures are available for this period yet.'}
        iconName={data?.access.hasAccess === false ? 'Lock' : 'Money'}
        action={
          <Button variant="secondary" onClick={() => navigate({ kind: 'hub' })}>
            Back to Travel Hub
          </Button>
        }
      />
    );
  }

  const dashboardUrl = data.spend.dashboardUrl ?? (configuration.spend.dashboardUrl !== '#' ? configuration.spend.dashboardUrl : undefined);

  return (
    <div className={styles.screen}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate({ kind: 'hub' })}>
          Home
        </button>
        <Icon iconName="ChevronRight" aria-hidden="true" />
        <span aria-current="page">Department Travel Spend</span>
      </nav>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Department Travel Spend Overview</h1>
          <p className={styles.subtitle}>
            {data.spend.department}
            {data.spend.period.length > 0 ? ` — ${data.spend.period}` : ''}
          </p>
        </div>
        {dashboardUrl !== undefined && (
          <Button variant="secondary" href={dashboardUrl} openInNewTab iconAfter="OpenInNewWindow">
            Open in Power BI
          </Button>
        )}
      </div>

      {dashboardUrl !== undefined ? (
        <div className={styles.embedWrap}>
          <iframe className={styles.embed} src={dashboardUrl} title="Department Travel Spend report" loading="lazy" />
        </div>
      ) : (
        <EmptyState message="No Power BI report is configured for this dashboard yet." iconName="BarChartVertical" />
      )}
    </div>
  );
};
