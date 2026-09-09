import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { IPolicyCard } from '../../../../models';
import styles from './PolicyPageScreen.module.scss';

/** A card that navigates in-app (TargetSlug) takes priority over an external LinkUrl. */
function CardLink({ card, children, className }: { card: IPolicyCard; children: React.ReactNode; className: string }): React.ReactElement {
  const { navigate } = useNavigation();
  if (card.targetSlug !== undefined) {
    return (
      <button type="button" className={className} onClick={() => navigate({ kind: 'policyPage', slug: card.targetSlug as string })}>
        {children}
      </button>
    );
  }
  if (card.linkUrl !== undefined) {
    return (
      <a className={className} href={card.linkUrl}>
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

/** Row 2 of the landing page — 3 policy-category cards, each linking to a detail page. */
export const CategoryCards: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className={styles.categoryGrid}>
      {cards.map((card) => (
        <CardLink key={card.id} card={card} className={styles.categoryCard}>
          <span className={styles.categoryIcon} style={card.iconColor !== undefined ? { color: card.iconColor } : undefined} aria-hidden="true">
            <Icon iconName={card.icon} />
          </span>
          <h3 className={styles.categoryTitle}>{card.title}</h3>
          <p className={styles.categoryDescription}>{card.description}</p>
          {card.linkText !== undefined && (
            <span className={styles.categoryLink}>
              {card.linkText} <Icon iconName="ChevronRight" aria-hidden="true" />
            </span>
          )}
        </CardLink>
      ))}
    </div>
  );
};

/** "Explore Policy Information" — a grid of small icon tiles. */
export const InfoCards: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className={styles.infoGrid}>
      {cards.map((card) => (
        <CardLink key={card.id} card={card} className={styles.infoCard}>
          <span className={styles.infoIcon} aria-hidden="true">
            <Icon iconName={card.icon} />
          </span>
          <span className={styles.infoTitle}>{card.title}</span>
        </CardLink>
      ))}
    </div>
  );
};

/** "Key Policy Highlights" — icon + title + description cards. */
export const HighlightCards: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className={styles.highlightGrid}>
      {cards.map((card) => (
        <div key={card.id} className={styles.highlightCard}>
          <span className={styles.highlightIcon} style={card.iconColor !== undefined ? { backgroundColor: card.iconColor } : undefined} aria-hidden="true">
            <Icon iconName={card.icon} />
          </span>
          <h3 className={styles.highlightTitle}>{card.title}</h3>
          {card.description.length > 0 && <p className={styles.highlightDescription}>{card.description}</p>}
          {card.subPoints.length > 0 && (
            <ul className={styles.highlightSubPoints}>
              {card.subPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

/** Numbered rule cards, e.g. the Annual Flight Ticket Benefits' 8 conditions. */
export const RuleCards: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className={styles.ruleGrid}>
      {cards.map((card) => (
        <div key={card.id} className={styles.ruleCard}>
          <span className={styles.ruleNumber} style={card.iconColor !== undefined ? { backgroundColor: card.iconColor } : undefined}>
            {card.number ?? '•'}
          </span>
          <div className={styles.ruleBody}>
            <h3 className={styles.ruleTitle}>{card.title}</h3>
            {card.description.length > 0 && <p className={styles.ruleDescription}>{card.description}</p>}
            {card.subPoints.length > 0 && (
              <ul className={styles.ruleSubPoints}>
                {card.subPoints.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/** The "Ask HR" style numbered process under the Need Help row. */
export const HelpSteps: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <ol className={styles.helpSteps}>
      {cards.map((card, index) => (
        <React.Fragment key={card.id}>
          <li className={styles.helpStep}>
            <span className={styles.helpStepNumber}>{card.number ?? index + 1}</span>
            <div>
              <div className={styles.helpStepTitle}>{card.title}</div>
              {card.description.length > 0 && <div className={styles.helpStepDescription}>{card.description}</div>}
            </div>
          </li>
          {index < cards.length - 1 && <Icon iconName="ChevronRight" className={styles.helpStepArrow} aria-hidden="true" />}
        </React.Fragment>
      ))}
    </ol>
  );
};
