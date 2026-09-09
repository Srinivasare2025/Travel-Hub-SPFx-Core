import * as React from 'react';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../../common/hooks';
import { SectionHeader, LoadingState, EmptyState, ErrorState } from '../../../../../common/components';
import { ITravelTeamMember } from '../../../../../models';
import { TravelTeamCard } from './TravelTeamCard';
import styles from './TravelTeamSection.module.scss';

export interface ITravelTeamSectionProps {
  title: string;
}

/** "Meet the Travel Team" — up to `team.landingPageCount` member cards (ASSUMPTIONS A29/A30). */
export const TravelTeamSection: React.FC<ITravelTeamSectionProps> = ({ title }) => {
  const { team, configuration } = useServices();
  const { status, data, retry } = useAsyncData(() => team.getTeamMembers(configuration), [configuration]);

  return (
    <section className={styles.root} aria-labelledby="th-team-heading">
      <SectionHeader
        title={title}
        headingLevel={2}
        id="th-team-heading"
        viewAll={{ ...configuration.team.viewAll, openInNewTab: false }}
      />

      {status === 'loading' && (
        <LoadingState variant="grid" count={configuration.team.landingPageCount} label={`Loading ${title}`} />
      )}
      {status === 'empty' && <EmptyState message="No travel team members are listed yet." iconName="ContactCard" />}
      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && data !== undefined && (
        <div className={styles.grid}>
          {data.map((member: ITravelTeamMember) => (
            <TravelTeamCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </section>
  );
};
