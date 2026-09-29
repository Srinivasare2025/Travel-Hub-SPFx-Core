import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Card, Button, LoadingState, ErrorState, EmptyState } from '../../../../../common/components';
import { IQuickPulseOption } from '../../../../../models';
import styles from './TravelerEngagementSection.module.scss';

/**
 * The Quick Pulse card shown on the hub (its own "Quick Pulse" title is a
 * matching `SectionHeader` rendered by `TravelerEngagementSection`, not
 * inside this card, so it lines up with the testimonials column's header):
 * question + selectable emoji/icon options + an optional comment box, all
 * submitted in place (no more full-screen "Submit Quick Pulse" redirect).
 * "View All Traveler Survey" still opens the dedicated results screen -
 * SECURITY.md §2, `QuickPulseService` never returns a list of individual
 * responses to this card.
 */
export const QuickPulseCard: React.FC = () => {
  const { quickPulse, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => quickPulse.getState(configuration), [configuration]);

  const [selectedValue, setSelectedValue] = React.useState<number | undefined>(undefined);
  const [comments, setComments] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | undefined>(undefined);
  const [justSubmitted, setJustSubmitted] = React.useState(false);

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
  const hasResponded = data.userHasResponded || justSubmitted;

  const handleSubmit = (): void => {
    if (selectedValue === undefined || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(undefined);
    quickPulse
      .submitResponse(
        { questionId: question.id, responseValue: selectedValue, comments: comments.trim().length > 0 ? comments.trim() : undefined },
        question.oneResponsePerUser
      )
      .then(() => {
        setJustSubmitted(true);
        setSubmitting(false);
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : 'Could not submit your response. Please try again.');
        setSubmitting(false);
      });
  };

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

      {hasResponded ? (
        <div className={styles.pulseThanks} role="status">
          <Icon iconName="CheckMark" aria-hidden="true" />
          <p>{configuration.quickPulse.confirmationMessage}</p>
        </div>
      ) : options.length === 0 ? (
        <EmptyState message="No response options are configured for this question right now." iconName="Feedback" />
      ) : (
        <>
          <div className={styles.pulsePreviewOptions} role="radiogroup" aria-label={question.question}>
            {options.map((option) => (
              <PulseOptionButton
                key={option.id}
                option={option}
                selected={selectedValue === option.value}
                onSelect={() => setSelectedValue(option.value)}
              />
            ))}
          </div>

          {selectedValue !== undefined && (
            <div className={styles.pulseSubmitRow}>
              {question.allowComments && (
                <textarea
                  className={styles.pulseComments}
                  placeholder="Add a comment (optional)"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  aria-label="Optional comment"
                />
              )}
              {submitError !== undefined && <p className={styles.pulseError}>{submitError}</p>}
              <Button variant="primary" type="submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Quick Pulse'}
              </Button>
            </div>
          )}
        </>
      )}

      {data.canViewResults && (
        <button type="button" className={styles.pulseResultsToggle} onClick={() => navigate({ kind: 'quickPulseResults' })}>
          View All Traveler Survey <Icon iconName="ChevronRight" aria-hidden="true" />
        </button>
      )}
    </Card>
  );
};

function PulseOptionButton({
  option,
  selected,
  onSelect
}: {
  option: IQuickPulseOption;
  selected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`${styles.pulsePreviewOption} ${selected ? styles.pulsePreviewOptionSelected : ''}`}
      onClick={onSelect}
    >
      <span className={styles.pulsePreviewOptionIcon}>
        <Icon iconName={option.icon} />
      </span>
      <span className={styles.pulsePreviewOptionLabel}>{option.title}</span>
    </button>
  );
}
