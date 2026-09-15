import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Button, LoadingState, ErrorState, EmptyState } from '../../../../../common/components';
import { IQuickPulseOption } from '../../../../../models';
import styles from './TravelerEngagementSection.module.scss';

/**
 * The dedicated Quick Pulse submission screen — reached from `QuickPulseCard`
 * ("Submit Response"). Text-labelled option buttons (e.g. "Very Difficult" …
 * "Very Easy", fully list-driven from `TH_QuickPulseOptions`), not the
 * card's decorative emoji-only preview.
 */
export const QuickPulseSubmitScreen: React.FC = () => {
  const { quickPulse, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => quickPulse.getState(configuration), [configuration]);

  const [selectedValue, setSelectedValue] = React.useState<number | undefined>(undefined);
  const [comments, setComments] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | undefined>(undefined);
  const [justSubmitted, setJustSubmitted] = React.useState(false);

  const handleSubmit = (): void => {
    if (selectedValue === undefined || submitting || data?.question === undefined) {
      return;
    }
    const question = data.question;
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
    <div className={styles.screen}>
      <button type="button" className={styles.screenBack} onClick={() => navigate({ kind: 'hub' })}>
        <Icon iconName="Back" aria-hidden="true" /> Back to Travel Hub
      </button>

      {status === 'loading' && <LoadingState variant="card" count={1} label="Loading Quick Pulse" />}
      {status === 'error' && <ErrorState onRetry={retry} />}
      {status === 'success' && data?.question === undefined && (
        <EmptyState message="There is no Quick Pulse question active right now." iconName="Feedback" />
      )}

      {status === 'success' && data?.question !== undefined && (
        <>
          <h1 className={styles.screenTitle}>Quick Pulse</h1>
          <p className={styles.screenDescription}>{data.question.question}</p>

          {data.options.length === 0 ? (
            <EmptyState
              message="No response options are configured for this question right now. Please check back later."
              iconName="Feedback"
            />
          ) : data.userHasResponded || justSubmitted ? (
            <div className={styles.pulseThanks} role="status">
              <Icon iconName="CheckMark" aria-hidden="true" />
              <p>{configuration.quickPulse.confirmationMessage}</p>
              <Button variant="secondary" onClick={() => navigate({ kind: 'hub' })}>
                Back to Travel Hub
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.screenOptions} role="radiogroup" aria-label={data.question.question}>
                {data.options.map((option) => (
                  <SubmitOptionButton
                    key={option.id}
                    option={option}
                    selected={selectedValue === option.value}
                    onSelect={() => setSelectedValue(option.value)}
                  />
                ))}
              </div>

              {selectedValue !== undefined && (
                <div className={styles.pulseSubmitRow}>
                  {data.question.allowComments && (
                    <textarea
                      className={styles.pulseComments}
                      placeholder="Add a comment (optional)"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      aria-label="Optional comment"
                    />
                  )}
                  {submitError !== undefined && <p className={styles.pulseError}>{submitError}</p>}
                  <Button variant="primary" type="submit" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit feedback'}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

function SubmitOptionButton({
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
      className={`${styles.screenOption} ${selected ? styles.screenOptionSelected : ''}`}
      onClick={onSelect}
    >
      <Icon iconName={option.icon} className={styles.screenOptionIcon} aria-hidden="true" />
      <span>{option.title}</span>
    </button>
  );
}
