import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { Badge, Button, LoadingState, ErrorState, EmptyState } from '../../../../common/components';
import { CategoryCards, InfoCards, HighlightCards, RuleCards, HelpSteps } from './PolicyCardSections';
import styles from './PolicyPageScreen.module.scss';

export interface IPolicyPageScreenProps {
  slug: string;
}

// RSG_Travel_Policy_Pages_1_2_Content_Specifications.docx §4 "Approved suggested
// questions" - decorative only (the assistant itself is a placeholder, deferred).
const ASSISTANT_SUGGESTED_QUESTIONS = [
  'What is my travel class entitlement?',
  'How can I claim my business travel expenses?',
  'What is my hotel accommodation cap?',
  'What are my daily and transportation allowances?'
];

/**
 * One adaptive template for every Travel Policy page (landing page included)
 * - `PolicyService.getPage()` returns whichever fields/cards that page has,
 * and each section below only renders when its data is present. Reached via
 * `NavigationContext`'s `policyPage` view (GlobalNav's built-in "Travel
 * Policy" tab, or a policy card's `TargetSlug`), not a real second page.
 */
export const PolicyPageScreen: React.FC<IPolicyPageScreenProps> = ({ slug }) => {
  const { policy } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => policy.getPage(slug), [slug]);

  if (status === 'loading') {
    return <LoadingState variant="hero" label="Loading Travel Policy" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (data === undefined) {
    return (
      <EmptyState
        message="This policy page isn't available."
        iconName="Page"
        action={
          <Button variant="secondary" onClick={() => navigate({ kind: 'hub' })}>
            Back to Travel Hub
          </Button>
        }
      />
    );
  }

  const categoryCards = data.cards.filter((c) => c.kind === 'category');
  const infoCards = data.cards.filter((c) => c.kind === 'info');
  const highlightCards = data.cards.filter((c) => c.kind === 'highlight');
  const ruleCards = data.cards.filter((c) => c.kind === 'rule');
  const helpStepCards = data.cards.filter((c) => c.kind === 'helpStep');
  const isTopLevel = data.parent === undefined;

  return (
    <div className={styles.screen}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate({ kind: 'hub' })}>
          Home
        </button>
        {data.parent !== undefined && (
          <>
            <Icon iconName="ChevronRight" aria-hidden="true" />
            <button type="button" onClick={() => navigate({ kind: 'policyPage', slug: (data.parent as { slug: string }).slug })}>
              {data.parent.title}
            </button>
          </>
        )}
        <Icon iconName="ChevronRight" aria-hidden="true" />
        <span aria-current="page">{data.title}</span>
      </nav>

      <div
        className={styles.hero}
        style={data.hero.imageUrl !== undefined ? { backgroundImage: `url(${data.hero.imageUrl})` } : undefined}
      >
        <div className={styles.heroScrim} aria-hidden="true" />
        <div className={styles.heroContent}>
          {data.hero.icon !== undefined && (
            <span className={styles.heroIcon} aria-hidden="true">
              <Icon iconName={data.hero.icon} />
            </span>
          )}
          <h1 className={styles.heroTitle}>{data.hero.title}</h1>
          {data.hero.subtitle !== undefined && <p className={styles.heroSubtitle}>{data.hero.subtitle}</p>}
          {data.hero.description !== undefined && <p className={styles.heroDescription}>{data.hero.description}</p>}
        </div>
        {data.hero.tagline !== undefined && <div className={styles.heroTagline}>{data.hero.tagline}</div>}
      </div>

      {data.infoBannerText !== undefined && (
        <div className={styles.infoBanner}>
          <Icon iconName="Info" aria-hidden="true" />
          <p>{data.infoBannerText}</p>
        </div>
      )}

      <CategoryCards cards={categoryCards} />

      {infoCards.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Explore Policy Information</h2>
          <p className={styles.sectionSubtitle}>Select a topic to view detailed information, guidelines and examples.</p>
          <InfoCards cards={infoCards} />
        </section>
      )}

      {highlightCards.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Key Policy Highlights</h2>
          <p className={styles.sectionSubtitle}>Quick guidance on important rules to keep in mind.</p>
          <HighlightCards cards={highlightCards} />
        </section>
      )}

      <RuleCards cards={ruleCards} />

      {data.noteBannerText !== undefined && (
        <div className={styles.noteBanner}>
          <Icon iconName="Warning" aria-hidden="true" />
          <p>{data.noteBannerText}</p>
        </div>
      )}

      {data.cta !== undefined && (
        <div className={styles.ctaRow}>
          <div>
            <h2 className={styles.ctaTitle}>{data.cta.title}</h2>
            <p className={styles.ctaDescription}>{data.cta.description}</p>
          </div>
          <div className={styles.ctaActions}>
            {data.cta.linkUrl !== undefined && data.cta.linkText !== undefined && (
              <a className={styles.ctaLink} href={data.cta.linkUrl}>
                {data.cta.linkText}
              </a>
            )}
            {data.cta.primaryUrl !== undefined && data.cta.primaryText !== undefined && (
              <Button variant="primary" href={data.cta.primaryUrl} iconAfter="ChevronRight">
                {data.cta.primaryText}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* AI assistant: a placeholder pending a decision on what it integrates
          with (Copilot Studio / Azure OpenAI / a plain FAQ search) - no
          service, no config; shown only on top-level pages like the mock. */}
      {isTopLevel && (
        <div className={styles.assistant}>
          <span className={styles.assistantIcon} aria-hidden="true">
            <Icon iconName="Robot" />
          </span>
          <div className={styles.assistantBody}>
            <div className={styles.assistantHeading}>
              <h2 className={styles.sectionTitle}>Ask Our Policy Assistant</h2>
              <Badge text="Coming Soon" tone="gold" />
            </div>
            <p className={styles.assistantDescription}>Get instant answers from RSG&rsquo;s Travel Policy.</p>
            <div className={styles.assistantInputRow}>
              <input className={styles.assistantInput} type="text" placeholder="Ask a question about the Travel Policy…" disabled />
              <span className={styles.assistantSend} aria-hidden="true">
                <Icon iconName="Send" />
              </span>
            </div>
            <div className={styles.assistantSuggestions}>
              <span className={styles.assistantSuggestionsLabel}>Try asking:</span>
              {ASSISTANT_SUGGESTED_QUESTIONS.map((question) => (
                <span key={question} className={styles.assistantChip}>
                  {question}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {data.needHelp !== undefined && (
        <div className={styles.needHelp}>
          <span className={styles.needHelpIcon} aria-hidden="true">
            <Icon iconName="Headset" />
          </span>
          <div className={styles.needHelpBody}>
            {data.needHelp.supportLabel !== undefined && <span className={styles.needHelpLabel}>{data.needHelp.supportLabel}</span>}
            <h2 className={styles.sectionTitle}>{data.needHelp.title}</h2>
            {data.needHelp.description.length > 0 && <p className={styles.needHelpDescription}>{data.needHelp.description}</p>}
            {data.needHelp.email !== undefined && (
              <a className={styles.needHelpEmail} href={`mailto:${data.needHelp.email}`}>
                <Icon iconName="Mail" aria-hidden="true" /> {data.needHelp.email}
              </a>
            )}
            <HelpSteps cards={helpStepCards} />
          </div>
        </div>
      )}

      {data.closingBanner !== undefined && (
        <div className={styles.closingBanner}>
          <Icon iconName="Leaf" className={styles.closingIcon} aria-hidden="true" />
          <div>
            <h2 className={styles.closingTitle}>{data.closingBanner.title}</h2>
            <p className={styles.closingDescription}>{data.closingBanner.description}</p>
          </div>
          {data.closingBanner.badges.length > 0 && (
            <div className={styles.closingBadges}>
              {data.closingBanner.badges.map((badge, index) => (
                <span key={index} className={styles.closingBadge}>
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
