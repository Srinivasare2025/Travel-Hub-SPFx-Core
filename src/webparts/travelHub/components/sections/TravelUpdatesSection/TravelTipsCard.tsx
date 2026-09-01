import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../../common/hooks';
import {
  Card,
  SectionHeader,
  LoadingState,
  EmptyState,
  ErrorState,
  ExternalLink
} from '../../../../../common/components';
import styles from './TravelUpdatesSection.module.scss';

/** Travel Tips & Insights: icon + text rows, optional per-tip link. */
export const TravelTipsCard: React.FC = () => {
  const { tips, configuration } = useServices();
  const { status, data, retry } = useAsyncData(() => tips.getTips(configuration), [configuration]);

  const viewAll = configuration.updates.viewAll.tips;

  return (
    <Card as="article" padding="lg" className={styles.column}>
      <SectionHeader title="Travel Tips &amp; Insights" headingLevel={3} viewAll={{ ...viewAll, openInNewTab: true }} />

      {status === 'loading' && <LoadingState variant="rows" count={5} label="Loading travel tips" />}
      {status === 'empty' && <EmptyState message="No travel tips are available yet." iconName="Lightbulb" />}
      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && data !== undefined && (
        <ul className={styles.tipList}>
          {data.map((tip) => (
            <li key={tip.id} className={styles.tipRow}>
              <span className={styles.tipIcon} aria-hidden="true">
                <Icon iconName={tip.icon} />
              </span>
              <div className={styles.tipBody}>
                {tip.linkUrl !== undefined ? (
                  <ExternalLink href={tip.linkUrl} openInNewTab className={styles.tipText}>
                    {tip.title}
                  </ExternalLink>
                ) : (
                  <span className={styles.tipText}>{tip.title}</span>
                )}
                {tip.description !== undefined && <span className={styles.tipDesc}>{tip.description}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
