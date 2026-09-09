import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Card, Button, LoadingState, ErrorState, EmptyState } from '../../../../../common/components';
import styles from './TravelerEngagementSection.module.scss';

/**
 * The Quick Pulse teaser card shown on the hub (its own "Quick Pulse" title
 * is a matching `SectionHeader` rendered by `TravelerEngagementSection`, not
 * inside this card, so it lines up with the testimonials column's header):
 * a preview (question + a decorative row of the configured option icons)
 * with two links out to dedicated full-screen "pages" — Submit Quick Pulse
 * and View All Traveler Survey (both are in-app screens via
 * `useNavigation()`, not the inline form this card used to be; see
 * `QuickPulseSubmitScreen`/`QuickPulseResultsScreen`). SECURITY.md §2 — this
 * component never renders a list of individual responses;
 * `QuickPulseService` never returns one to it.
 */
export const QuickPulseCard: React.FC = () => {
  const { quickPulse, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => quickPulse.getState(configuration), [configuration]);

  if (status === 'loading') {
    return <LoadingState variant="card" count={1} label="Loading Quick Pulse" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (data === undefined || data.question === undefined) {
    return <EmptyState message="There is no Quick Pulse question active right now." iconName="Feedback" />;
  }

  const { question, options } = data;

  return (
    <Card padding="lg" className={styles.pulseCard}>
      <div className={styles.pulseHeader}>
        <span className={styles.pulseIcon} aria-hidden="true">
          <Icon iconName="Feedback" />
        </span>
        <span className={styles.pulseTimeHint}>
          <Icon iconName="Clock" aria-hidden="true" /> Takes less than 30 seconds
        </span>
      </div>

      <p className={styles.pulseQuestion}>{question.question}</p>

      {options.length > 0 && (
        <div className={styles.pulsePreviewOptions} aria-hidden="true">
          {options.map((option) => (
            <span key={option.id} className={styles.pulsePreviewOption}>
              <Icon iconName={option.icon} />
            </span>
          ))}
        </div>
      )}

      {data.userHasResponded ? (
        <div className={styles.pulseThanks} role="status">
          <Icon iconName="CheckMark" aria-hidden="true" />
          <p>{configuration.quickPulse.confirmationMessage}</p>
        </div>
      ) : (
        <Button variant="primary" onClick={() => navigate({ kind: 'quickPulseSubmit' })}>
          Submit Quick Pulse
        </Button>
      )}

      {data.canViewResults && (
        <button type="button" className={styles.pulseResultsToggle} onClick={() => navigate({ kind: 'quickPulseResults' })}>
          View All Traveler Survey <Icon iconName="ChevronRight" aria-hidden="true" />
        </button>
      )}
    </Card>
  );
};
