import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { LoadingState, EmptyState, ErrorState } from '../../../../../common/components';
import { ITravelTeamMember } from '../../../../../models';
import { TravelTeamCard } from './TravelTeamCard';
import styles from './TravelTeamSection.module.scss';

/**
 * "View All Team Members" — every active team member (not just the landing
 * page's `team.landingPageCount`), reached from `TravelTeamSection`'s
 * "View All Team Members" link.
 */
export const TravelTeamAllScreen: React.FC = () => {
  const { team } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => team.getAllTeamMembers(), []);

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.screenBack} onClick={() => navigate({ kind: 'hub' })}>
        <Icon iconName="Back" aria-hidden="true" /> Back to Travel Hub
      </button>

      <h1 className={styles.screenTitle}>Meet the Travel Team</h1>

      {status === 'loading' && <LoadingState variant="grid" count={8} label="Loading the travel team" />}
      {status === 'error' && <ErrorState onRetry={retry} />}
      {status === 'empty' && <EmptyState message="No travel team members are listed yet." iconName="ContactCard" />}

      {status === 'success' && data !== undefined && (
        <div className={styles.grid}>
          {data.map((member: ITravelTeamMember) => (
            <TravelTeamCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
};
