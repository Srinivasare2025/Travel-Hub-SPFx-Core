import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { LoadingState, ErrorState, EmptyState } from '../../../../../common/components';
import { IQuickPulseAggregate } from '../../../../../models';
import styles from './TravelerEngagementSection.module.scss';

interface IResultsData {
  question: string | undefined;
  canView: boolean;
  aggregate: IQuickPulseAggregate | undefined;
}

/**
 * The dedicated Quick Pulse results screen — reached from `QuickPulseCard`
 * ("View Previous Results"). Aggregate counts only (SECURITY.md §2); never
 * fetched, let alone rendered, unless the current user is a Pulse Admin and
 * `quickPulse.showAggregateResults` is on.
 */
export const QuickPulseResultsScreen: React.FC = () => {
  const { quickPulse, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData<IResultsData>(async () => {
    const state = await quickPulse.getState(configuration);
    if (!state.canViewResults || state.question === undefined) {
      return { question: state.question?.question, canView: state.canViewResults, aggregate: undefined };
    }
    const aggregate = await quickPulse.getAggregate(state.question.id);
    return { question: state.question.question, canView: true, aggregate };
  }, [configuration]);

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.screenBack} onClick={() => navigate({ kind: 'hub' })}>
        <Icon iconName="Back" aria-hidden="true" /> Back to Travel Hub
      </button>

      {status === 'loading' && <LoadingState variant="rows" count={3} label="Loading Quick Pulse results" />}
      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && data !== undefined && !data.canView && (
        <ErrorState variant="forbidden" message="Quick Pulse results are visible to Pulse Admins only." />
      )}

      {status === 'success' && data !== undefined && data.canView && (
        <>
          <h1 className={styles.screenTitle}>Quick Pulse results</h1>
          {data.question !== undefined && <p className={styles.screenDescription}>{data.question}</p>}

          {data.aggregate === undefined || data.aggregate.totalResponses === 0 ? (
            <EmptyState message="No responses recorded yet." iconName="BarChart4" />
          ) : (
            <ul className={styles.pulseBreakdown}>
              {data.aggregate.breakdown.map((row) => (
                <li key={row.value} className={styles.pulseBreakdownRow}>
                  <span>{row.value}</span>
                  <span className={styles.pulseBar} aria-hidden="true">
                    <span style={{ width: `${String(row.percent)}%` }} />
                  </span>
                  <span>{row.percent}%</span>
                </li>
              ))}
              <li className={styles.pulseBreakdownTotal}>{data.aggregate.totalResponses} total responses</li>
            </ul>
          )}
        </>
      )}
    </div>
  );
};
