import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { Button } from '../../../../../common/components';
import styles from './TravelerEngagementSection.module.scss';

const CATEGORY_SUGGESTIONS = ['Business Travel', 'Personal Travel', 'Travel Care', 'SAP Concur', 'Catering Services', 'Meetings & Events'];

/**
 * "Submit Feedback" — reached from `ViewAllFeedbackScreen`. Writes a new
 * `TH_TravelerTestimonials` row via `submitFeedback()`, which sets
 * `IsActive = false`: the submission is held for moderation and won't appear
 * on the hub until an admin reviews and activates it (SECURITY.md's general
 * caution about user-submitted content, applied here the same way Quick
 * Pulse never trusts the client). The submitter's name is their signed-in
 * identity, not a field on this form.
 */
export const SubmitFeedbackScreen: React.FC = () => {
  const { testimonials } = useServices();
  const { navigate } = useNavigation();

  const [rating, setRating] = React.useState(5);
  const [category, setCategory] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [designation, setDesignation] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (): void => {
    if (comment.trim().length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(undefined);
    testimonials
      .submitFeedback({
        rating,
        comment: comment.trim(),
        category: category.trim().length > 0 ? category.trim() : undefined,
        designation: designation.trim().length > 0 ? designation.trim() : undefined,
        department: department.trim().length > 0 ? department.trim() : undefined,
        location: location.trim().length > 0 ? location.trim() : undefined
      })
      .then(() => {
        setSubmitted(true);
        setSubmitting(false);
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : 'Could not submit your feedback. Please try again.');
        setSubmitting(false);
      });
  };

  if (submitted) {
    return (
      <div className={styles.screen}>
        <div className={styles.pulseThanks} role="status">
          <Icon iconName="CheckMark" aria-hidden="true" />
          <p>Thanks for sharing your story — it will appear once reviewed.</p>
        </div>
        <div className={styles.feedbackSubmitRow}>
          <Button variant="secondary" onClick={() => navigate({ kind: 'testimonialsAll' })}>
            Back to Traveller Stories
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.screenBack} onClick={() => navigate({ kind: 'testimonialsAll' })}>
        <Icon iconName="Back" aria-hidden="true" /> Back to Traveller Stories
      </button>

      <h1 className={styles.screenTitle}>Submit Feedback</h1>
      <p className={styles.screenDescription}>Share your travel experience — your story helps other travellers.</p>

      <div className={styles.feedbackForm}>
        <label className={styles.formLabel}>
          Rating
          <div className={styles.ratingPicker} role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} out of 5 stars`}
                className={styles.ratingStar}
                onClick={() => setRating(value)}
              >
                <Icon iconName={value <= rating ? 'FavoriteStarFill' : 'FavoriteStar'} />
              </button>
            ))}
          </div>
        </label>

        <label className={styles.formLabel}>
          Category (optional)
          <input
            className={styles.formInput}
            type="text"
            list="th-feedback-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Business Travel, Travel Care"
            maxLength={100}
          />
          <datalist id="th-feedback-category-suggestions">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className={styles.formLabel}>
          Your story (required)
          <textarea
            className={styles.formTextarea}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience…"
            rows={4}
            maxLength={1000}
            required
            aria-required="true"
          />
        </label>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            Designation (optional)
            <input className={styles.formInput} type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={100} />
          </label>
          <label className={styles.formLabel}>
            Department (optional)
            <input className={styles.formInput} type="text" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
          </label>
          <label className={styles.formLabel}>
            Location (optional)
            <input className={styles.formInput} type="text" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} />
          </label>
        </div>

        {submitError !== undefined && <p className={styles.pulseError}>{submitError}</p>}

        <Button variant="primary" type="submit" onClick={handleSubmit} disabled={submitting || comment.trim().length === 0}>
          {submitting ? 'Submitting…' : 'Submit Feedback'}
        </Button>
      </div>
    </div>
  );
};
