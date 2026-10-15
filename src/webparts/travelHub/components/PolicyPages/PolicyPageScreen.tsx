import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { Badge, Button, LoadingState, ErrorState, EmptyState, backgroundFor } from '../../../../common/components';
import { SectionFlow, HelpSteps, PageLink, BUSINESS_TRAVEL_SLUG } from './PolicyCardSections';
import type { IPolicyPageContent } from '../../../../models';
import styles from './PolicyPageScreen.module.scss';

export interface IPolicyPageScreenProps {
  slug: string;
}

/**
 * Picks a Fluent icon for a closing-banner badge from its label text (e.g.
 * "Our People" / "Our Planet" / "Our Future") so content owners get the
 * right icon just by typing the usual label, with no schema change needed.
 */
function closingBadgeIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('people')) {
    return 'Group';
  }
  if (l.includes('planet')) {
    return 'Flower';
  }
  if (l.includes('future')) {
    return 'BarChart4';
  }
  return 'CheckMark';
}

/** Optional brand logo above the hero eyebrow (TH_PolicyPages.HeroLogoUrl), e.g. a catering partner's logo. */
const HeroLogo: React.FC<{ hero: IPolicyPageContent['hero'] }> = ({ hero }) =>
  hero.logoUrl === undefined ? null : <img className={styles.heroLogo} src={hero.logoUrl} alt={hero.eyebrow ?? ''} />;

/** Optional icon + text badges under the hero description (TH_PolicyPages.HeroHighlights). */
const HeroHighlights: React.FC<{ hero: IPolicyPageContent['hero'] }> = ({ hero }) =>
  hero.highlights.length === 0 ? null : (
    <ul className={styles.heroHighlights}>
      {hero.highlights.map((item, index) => (
        <li key={index} className={styles.heroHighlight}>
          {item.icon !== undefined && <Icon iconName={item.icon} aria-hidden="true" />}
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );

/**
 * The banner photo panel: always the same 62% of the banner on every page.
 *
 * It briefly sized itself to each photo's shape (38%-62%), which made every
 * page's banner look different - a wide photo (Business Travel) kept the full
 * panel while a less-wide one shrank to a narrow strip with a large empty
 * band. Back to one panel for all pages; the crop sits slightly above centre
 * (keeps heads/tops in view) and an editor can steer it per photo with
 * `#focus=top` on the image URL (common/utils/imageHints.ts).
 */
const HeroPhoto: React.FC<{ src: string }> = ({ src }) => {
  const bg = backgroundFor(src, 'center 30%');
  return (
    <div
      className={styles.heroLightImage}
      style={{ backgroundImage: `url("${bg.url}")`, backgroundPosition: bg.position, backgroundSize: bg.size }}
      aria-hidden="true"
    />
  );
};

/**
 * The page banner - one style for every page (the SAP Concur look): eyebrow,
 * title, subtitle, description, badges and buttons on a light band, the
 * photo fading in on the right, the script tagline over the photo.
 * TH_PolicyPages.HeroStyle no longer switches to the old dark photo banner,
 * so pages created by hand (whose HeroStyle defaults to "Dark") match the
 * rest. Exported for other screens' banners (e.g. Green Travel).
 */
export const PageHero: React.FC<{ hero: IPolicyPageContent['hero'] }> = ({ hero }) => (
  <div className={styles.heroLight}>
    {hero.imageUrl !== undefined && <HeroPhoto src={hero.imageUrl} />}
    <div className={styles.heroLightContent}>
      {hero.icon !== undefined && (
        <span className={styles.heroLightIcon} aria-hidden="true">
          <Icon iconName={hero.icon} />
        </span>
      )}
      <div className={styles.heroLightText}>
        <HeroLogo hero={hero} />
        {hero.eyebrow !== undefined && <p className={styles.heroEyebrow}>{hero.eyebrow}</p>}
        <h1 className={styles.heroLightTitle}>{hero.title}</h1>
        {hero.subtitle !== undefined && <p className={styles.heroLightSubtitle}>{hero.subtitle}</p>}
        {hero.description !== undefined && <p className={styles.heroLightDescription}>{hero.description}</p>}
        <HeroHighlights hero={hero} />
        {hero.links.length > 0 && (
          <div className={styles.heroLinks}>
            {hero.links.map((link, index) => (
              <PageLink
                key={index}
                targetSlug={link.targetSlug}
                url={link.url}
                openInNewTab={link.openInNewTab}
                className={index === 0 ? styles.heroButtonPrimary : styles.heroButtonSecondary}
              >
                {link.text} <Icon iconName={link.openInNewTab ? 'OpenInNewWindow' : 'ArrowRight'} aria-hidden="true" />
              </PageLink>
            ))}
          </div>
        )}
      </div>
    </div>
    {hero.tagline !== undefined && <div className={styles.heroLightTagline}>{hero.tagline}</div>}
  </div>
);

/**
 * One adaptive template for every Travel Policy page (landing page included)
 * - `PolicyService.getPage()` returns the page's fixed fields (hero, CTA,
 * Need Help, closing banner) plus `sections`, an ordered list of content
 * blocks each rendered by `PolicySectionBlock` according to its own
 * `layout`. This is what lets the same template serve pages with entirely
 * different content shapes (paragraphs, tables, tabs, numbered steps, …)
 * without page-specific code. Reached via `NavigationContext`'s
 * `policyPage` view (GlobalNav's built-in "Travel Policy" tab, or a policy
 * card's `TargetSlug`), not a real second page.
 */
export const PolicyPageScreen: React.FC<IPolicyPageScreenProps> = ({ slug }) => {
  const { policy, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => policy.getPage(slug), [slug]);
  const assistant = configuration.policyAssistant;

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

  const assistantUrl = data.assistantLinkUrl ?? assistant.url;
  const closingImage = data.closingBanner?.imageUrl ?? configuration.pages.closingBannerImageUrl;

  return (
    <div className={styles.screen}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate({ kind: 'hub' })}>
          Home
        </button>
        {data.parent !== undefined && (
          <>
            <Icon iconName="ChevronRight" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                const parent = data.parent as { slug: string };
                navigate(parent.slug === BUSINESS_TRAVEL_SLUG ? { kind: 'businessTravel' } : { kind: 'policyPage', slug: parent.slug });
              }}
            >
              {data.parent.title}
            </button>
          </>
        )}
        {data.parentSectionLabel !== undefined && (
          <>
            <Icon iconName="ChevronRight" aria-hidden="true" />
            <span>{data.parentSectionLabel}</span>
          </>
        )}
        <Icon iconName="ChevronRight" aria-hidden="true" />
        <span aria-current="page">{data.title}</span>
      </nav>

      <PageHero hero={data.hero} />

      {data.infoBannerText !== undefined && (
        <div className={styles.infoBanner}>
          <Icon iconName="Info" aria-hidden="true" />
          <p>{data.infoBannerText}</p>
        </div>
      )}

      <SectionFlow sections={data.sections} />

      {data.noteBannerText !== undefined && (
        <div className={styles.noteBanner}>
          <Icon iconName="Warning" aria-hidden="true" />
          <p>{data.noteBannerText}</p>
        </div>
      )}

      {/* "Ready to proceed?" - title/description left; right, the two
          list-configured links (TH_PolicyPages CtaLinkText/CtaLinkUrl and
          CtaPrimaryText/CtaPrimaryUrl) separated by a divider, e.g.
          "Full Rules & Conditions | Apply ->". Either link may be left blank. */}
      {data.cta !== undefined && (
        <div className={styles.ctaRow}>
          <div className={styles.ctaText}>
            <h2 className={styles.ctaTitle}>{data.cta.title}</h2>
            {data.cta.description.length > 0 && <p className={styles.ctaDescription}>{data.cta.description}</p>}
          </div>
          <div className={styles.ctaActions}>
            {data.cta.linkUrl !== undefined && data.cta.linkText !== undefined && (
              <a className={styles.ctaLink} href={data.cta.linkUrl}>
                {data.cta.linkText}
              </a>
            )}
            {data.cta.linkUrl !== undefined &&
              data.cta.linkText !== undefined &&
              data.cta.primaryUrl !== undefined &&
              data.cta.primaryText !== undefined && <span className={styles.ctaDivider} aria-hidden="true" />}
            {data.cta.primaryUrl !== undefined && data.cta.primaryText !== undefined && (
              <a className={`${styles.ctaLink} ${styles.ctaPrimaryLink}`} href={data.cta.primaryUrl}>
                {data.cta.primaryText}
                <Icon iconName="ArrowRight" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* AI assistant: a placeholder pending a decision on what it integrates
          with (Copilot Studio / Azure OpenAI / a plain FAQ search) - no
          service, no config. Shown whenever the content owner has set
          suggested questions for this page (the landing page and the 6
          "Explore Policy Information" sub-pages, not the Annual Flight
          Ticket Benefits page - Content Specifications §4/§PAGE 2).
          Two layouts, picked by whether `assistantLinkUrl` is configured:
          unset keeps the inline search-box (Travel Policy landing page);
          set switches to icon+title/description with an "Ask a Question"
          button and the suggestions in their own row below (the 6 "Explore
          Policy Information" sub-pages). */}
      {/* Ask Our Policy Assistant: launches the organisation's policy agent
          (e.g. a Copilot Studio agent) in a new tab - the link is the page's
          AssistantLinkUrl, else the site-wide policyAssistant.url
          (TH_SiteConfiguration). There is no in-page chat/search box. Shown
          when the page has suggested questions or an agent link. */}
      {(data.suggestedQuestions.length > 0 || data.assistantLinkUrl !== undefined) && (
        <div className={styles.assistant}>
          <span className={styles.assistantIcon} aria-hidden="true">
            <Icon iconName="Robot" />
          </span>
          <div className={styles.assistantBody}>
            <div className={styles.assistantTopRow}>
              <div>
                <div className={styles.assistantHeading}>
                  <h2 className={styles.sectionTitle}>{assistant.title}</h2>
                  <Badge text="AI Powered" tone="gold" />
                </div>
                <p className={styles.assistantDescription}>{assistant.description}</p>
              </div>
              {assistantUrl !== undefined && (
                <Button variant="primary" href={assistantUrl} openInNewTab iconAfter="OpenInNewWindow">
                  {data.assistantLinkText ?? assistant.buttonText}
                </Button>
              )}
            </div>
            {data.suggestedQuestions.length > 0 && (
              <div className={styles.assistantSuggestions}>
                <span className={styles.assistantSuggestionsLabel}>Try asking:</span>
                {data.suggestedQuestions.map((question) => (
                  <span key={question} className={`${styles.assistantChip} ${styles.assistantChipIconed}`}>
                    <Icon iconName="Search" aria-hidden="true" />
                    {question}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {data.needHelp !== undefined && (
        <div className={styles.needHelp}>
          <span className={styles.needHelpIcon} aria-hidden="true">
            <Icon iconName="Headset" />
          </span>
          <div className={`${styles.needHelpBody} ${data.needHelp.steps.length > 0 ? styles.needHelpWithSteps : ''}`}>
            <div className={styles.needHelpText}>
              <h2 className={styles.sectionTitle}>{data.needHelp.title}</h2>
              {data.needHelp.supportLabel !== undefined && <span className={styles.needHelpLabel}>{data.needHelp.supportLabel}</span>}
              {data.needHelp.description.length > 0 && <p className={styles.needHelpDescription}>{data.needHelp.description}</p>}
            </div>
            {(data.needHelp.email !== undefined || data.needHelp.steps.length > 0) && (
              <div className={styles.needHelpTrailing}>
                {data.needHelp.email !== undefined && (
                  <a className={styles.needHelpEmail} href={`mailto:${data.needHelp.email}`}>
                    <Icon iconName="Mail" aria-hidden="true" /> {data.needHelp.email}
                  </a>
                )}
                <HelpSteps cards={data.needHelp.steps} />
              </div>
            )}
          </div>
        </div>
      )}

      {data.closingBanner !== undefined && (
        // With a photo (TH_PolicyPages.ClosingBannerImageUrl, else the site-wide
        // pages.closingBannerImageUrl) the text sits over the image on a navy
        // scrim; without one it keeps the original green band.
        <div
          className={`${styles.closingBanner} ${closingImage !== undefined ? styles.closingBannerImage : ''}`}
          style={
            closingImage !== undefined
              ? (() => {
                  const bg = backgroundFor(closingImage, 'center 40%');
                  return { backgroundImage: `url("${bg.url}")`, backgroundPosition: bg.position };
                })()
              : undefined
          }
        >
          <Icon iconName="Flower" className={styles.closingIcon} aria-hidden="true" />
          <div>
            <h2 className={styles.closingTitle}>{data.closingBanner.title}</h2>
            <p className={styles.closingDescription}>{data.closingBanner.description}</p>
          </div>
          {data.closingBanner.badges.length > 0 && (
            <div className={styles.closingBadges}>
              {data.closingBanner.badges.map((badge, index) => (
                <span key={index} className={styles.closingBadge}>
                  <span className={styles.closingBadgeIcon} aria-hidden="true">
                    <Icon iconName={closingBadgeIcon(badge)} />
                  </span>
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
