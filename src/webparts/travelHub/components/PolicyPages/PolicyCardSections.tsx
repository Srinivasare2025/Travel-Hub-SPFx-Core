import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { ImageWithFallback } from '../../../../common/components';
import { IPolicyCard, IPolicySection, IPolicyTable, IPolicyTab } from '../../../../models';
import { parseHighlightSubPoints, extractTag, ParsedSubPoint } from './parseHighlightSubPoints';
import styles from './PolicyPageScreen.module.scss';

/**
 * Sections whose `HighlightCards` get the icon-left/title-right header
 * layout (mock) instead of the default icon-on-top layout - matched by exact
 * section title so every other `cardVariant: 'highlight'` section elsewhere
 * (subpages not covered by this pass) keeps rendering exactly as before.
 */
const ICON_LEFT_HEADER_SECTIONS: ReadonlySet<string> = new Set([
  'Key Policy Highlights',
  'Which Policy Applies to Your Travel?',
  'How We Approach Business Travel',
  'Shared Responsibility',
  'Audit & Accountability',
  'Important Reminder',
  'Support While You Relocate',
  'Types of Relocation'
]);

/** Within `ICON_LEFT_HEADER_SECTIONS`, sections whose card title also gets a colored underline (from `card.iconColor`) below it, e.g. Guiding Principles' 6 approach cards. */
const UNDERLINE_TITLE_SECTIONS: ReadonlySet<string> = new Set(['How We Approach Business Travel']);

const SECTION_NUMBER_RE = /^(\d+)[.)]\s*(.+)$/;

/**
 * Opt-in section number badge: a section whose Title is typed as "1. Shared
 * Responsibility" (the way a content editor would naturally write it, no
 * schema change) renders a numbered circle badge followed by the rest of
 * the title; any other title renders as plain text.
 */
function renderSectionTitle(title: string): React.ReactNode {
  const match = SECTION_NUMBER_RE.exec(title);
  if (match === null) {
    return title;
  }
  return (
    <>
      <span className={styles.sectionNumber} aria-hidden="true">
        {match[1]}
      </span>
      {match[2]}
    </>
  );
}

/** The reserved TargetSlug value that links a card to the dedicated Business Travel hub screen instead of a Policy page - see BUSINESS_TRAVEL_SLUG usage in PolicyPageScreen.tsx too. */
export const BUSINESS_TRAVEL_SLUG = 'business-travel';

/** A card that navigates in-app (TargetSlug) takes priority over an external LinkUrl. */
function CardLink({ card, children, className }: { card: IPolicyCard; children: React.ReactNode; className: string }): React.ReactElement {
  const { navigate } = useNavigation();
  if (card.targetSlug !== undefined) {
    const slug = card.targetSlug;
    return (
      <button
        type="button"
        className={className}
        onClick={() => navigate(slug === BUSINESS_TRAVEL_SLUG ? { kind: 'businessTravel' } : { kind: 'policyPage', slug })}
      >
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
          <div className={styles.categoryBody}>
            <h3 className={styles.categoryTitle}>{card.title}</h3>
            <p className={styles.categoryDescription}>{card.description}</p>
            {card.linkText !== undefined && (
              <span className={styles.categoryLink}>
                {card.linkText} <Icon iconName="ChevronRight" aria-hidden="true" />
              </span>
            )}
          </div>
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

const TABLE_CELL_ICON_RE = /^([A-Za-z]+)::(.+)$/;

/**
 * A table's first-column cell. Written as plain text, or as `IconName::Text`
 * (e.g. `MapPin::GCC Countries`) to render a small icon before the text -
 * e.g. a per-Travel-Type icon in "Plan Before Your Travel"'s table. No
 * schema change (still the same `CellValues`/mini-table row text).
 */
const TableCell: React.FC<{ value: string }> = ({ value }) => {
  const match = TABLE_CELL_ICON_RE.exec(value);
  if (match === null) {
    return <>{value}</>;
  }
  return (
    <span className={styles.tableCellIconed}>
      <Icon iconName={match[1]} aria-hidden="true" /> {match[2]}
    </span>
  );
};

/** One parsed `SubPoints` block - see parseHighlightSubPoints.ts. */
const SubPointsBlocks: React.FC<{ subPoints: string[] }> = ({ subPoints }) => {
  if (subPoints.length === 0) {
    return null;
  }
  const blocks = parseHighlightSubPoints(subPoints);

  const bullets = blocks.filter(
    (b): b is Extract<ParsedSubPoint, { kind: 'bullet' | 'iconBullet' }> => b.kind === 'bullet' || b.kind === 'iconBullet'
  );
  const nonBullets = blocks.filter((b) => b.kind !== 'bullet' && b.kind !== 'iconBullet');

  return (
    <>
      {bullets.length > 0 && (
        <ul className={styles.highlightSubPoints}>
          {bullets.map((b, index) =>
            b.kind === 'iconBullet' ? (
              <li key={index} className={styles.highlightSubPointIconed}>
                <Icon iconName={b.icon} aria-hidden="true" /> {b.text}
              </li>
            ) : (
              <li key={index}>{b.text}</li>
            )
          )}
        </ul>
      )}
      {nonBullets.map((block, index) => {
        if (block.kind === 'table') {
          return (
            <div key={index} className={styles.highlightTableWrap}>
              <table className={styles.highlightTable}>
                <thead>
                  <tr>
                    {block.headers.map((h, i) => (
                      <th key={i} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}>{c === 0 ? <TableCell value={cell} /> : cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.kind === 'callout') {
          return (
            <div key={index} className={styles.highlightCallout}>
              <Icon iconName="Info" aria-hidden="true" />
              <p>
                {block.label !== undefined && <strong>{block.label} </strong>}
                {block.text}
              </p>
            </div>
          );
        }
        if (block.kind === 'iconBlock') {
          return (
            <div key={index} className={styles.highlightIconBlock}>
              <Icon iconName={block.icon} aria-hidden="true" />
              <div className={styles.highlightIconBlockBody}>
                <strong>{block.heading}</strong>
                <p>{block.text}</p>
              </div>
            </div>
          );
        }
        // kind === 'numbered'
        return (
          <ol key={index} className={styles.highlightNumbered}>
            {block.items.map((item, i) => (
              <li key={i}>
                <span className={styles.highlightNumberedBadge}>{i + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        );
      })}
    </>
  );
};

/** "Key Policy Highlights" style — icon + title + description cards, e.g. comparison cards too. */
export const HighlightCards: React.FC<{ cards: IPolicyCard[]; sectionTitle?: string }> = ({ cards, sectionTitle }) => {
  if (cards.length === 0) {
    return null;
  }
  const iconLeft = sectionTitle !== undefined && ICON_LEFT_HEADER_SECTIONS.has(sectionTitle);
  const underlineTitle = iconLeft && sectionTitle !== undefined && UNDERLINE_TITLE_SECTIONS.has(sectionTitle);

  return (
    <div className={styles.highlightGrid}>
      {cards.map((card) => {
        // A leading `%%Tag` line in SubPoints (e.g. "Traveler" / "Approver")
        // becomes a header badge instead of body text - see parseHighlightSubPoints.ts.
        const { tag, rest } = extractTag(card.subPoints);
        const titleClassName = underlineTitle ? `${styles.highlightTitle} ${styles.highlightTitleUnderline}` : styles.highlightTitle;
        const titleStyle = underlineTitle && card.iconColor !== undefined ? { borderColor: card.iconColor } : undefined;
        return (
          <div key={card.id} className={styles.highlightCard}>
            {tag !== undefined && <span className={styles.highlightTag}>{tag}</span>}
            {iconLeft ? (
              <div className={styles.highlightHeaderRow}>
                <span className={styles.highlightIcon} style={card.iconColor !== undefined ? { backgroundColor: card.iconColor } : undefined} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
                <h3 className={titleClassName} style={titleStyle}>
                  {card.title}
                </h3>
              </div>
            ) : (
              <>
                <span className={styles.highlightIcon} style={card.iconColor !== undefined ? { backgroundColor: card.iconColor } : undefined} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
                <h3 className={styles.highlightTitle}>{card.title}</h3>
              </>
            )}
            {card.description.length > 0 && <p className={styles.highlightDescription}>{card.description}</p>}
            <SubPointsBlocks subPoints={rest} />
          </div>
        );
      })}
    </div>
  );
};

/** Numbered rule cards, e.g. the Annual Flight Ticket Benefits' 8 conditions, or any `numberedSteps` section. */
export const RuleCards: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className={styles.ruleGrid}>
      {cards.map((card) => (
        <div key={card.id} className={styles.ruleCard}>
          <div className={styles.ruleBadgeGroup}>
            <span className={styles.ruleNumber} style={card.iconColor !== undefined ? { backgroundColor: card.iconColor } : undefined}>
              {card.number ?? '•'}
            </span>
            <span className={styles.ruleIcon} aria-hidden="true">
              <Icon iconName={card.icon} />
            </span>
          </div>
          <div className={styles.ruleBody}>
            <h3 className={styles.ruleTitle}>{card.title}</h3>
            {card.description.length > 0 && <p className={styles.ruleDescription}>{card.description}</p>}
            {/* Same SubPoints markup convention as HighlightCards (see
                parseHighlightSubPoints.ts) - lets a Rule card's sub-bullets
                opt into a mini table, a callout or an icon+heading block,
                e.g. "Seasonal periods include:" (`!!Seasonal periods
                include:` followed by its bullet lines). */}
            <SubPointsBlocks subPoints={card.subPoints} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * The "Ask HR" style numbered process under the Need Help row, or any
 * `processSteps` section, e.g. "Compliance Starts Before Travel". A card
 * with `Number` set (Ask HR) shows that number badge; a card left without
 * one (a general process-steps section) shows its icon in the badge
 * instead, e.g. "Plan Early" → "Obtain Approval" → "Use Approved Channels".
 */
export const HelpSteps: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <ol className={styles.helpSteps}>
      {cards.map((card, index) => (
        <React.Fragment key={card.id}>
          <li className={styles.helpStep}>
            <span className={styles.helpStepNumber}>
              {card.number !== undefined ? card.number : <Icon iconName={card.icon} aria-hidden="true" />}
            </span>
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

/** Free-text paragraphs - `IPolicySection.body`, one `<p>` per non-empty line. */
const ParagraphBlock: React.FC<{ body: string | undefined }> = ({ body }) => {
  const paragraphs = (body ?? '').split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  if (paragraphs.length === 0) {
    return null;
  }
  return (
    <>
      {paragraphs.map((p, index) => (
        <p key={index} className={styles.paragraphBody}>
          {p}
        </p>
      ))}
    </>
  );
};

/** One accessible data table, e.g. "Air Travel Entitlement". Several may stack in one `table` section/tab. */
const TableBlock: React.FC<{ tables: IPolicyTable[] }> = ({ tables }) => {
  if (tables.length === 0) {
    return null;
  }
  return (
    <>
      {tables.map((table) => (
        <div key={table.id} className={styles.tableWrap}>
          {table.title !== undefined && <h3 className={styles.tableTitle}>{table.title}</h3>}
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {table.columnHeaders.map((header, index) => (
                    <th key={index} scope="col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => (
                      <td key={index}>{index === 0 ? <TableCell value={cell} /> : cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
};

/** One tab's content - its own tables (if any) then its own cards, e.g. Travel Entitlement's 2 views. */
const TabPanel: React.FC<{ tab: IPolicyTab }> = ({ tab }) => (
  <div className={styles.tabPanel} role="tabpanel">
    <TableBlock tables={tab.tables} />
    <HighlightCards cards={tab.cards} />
  </div>
);

/** A `Layout: 'tabs'` section, e.g. "Business Travel" vs "Business Assignment" entitlements. */
const TabsBlock: React.FC<{ tabs: IPolicyTab[] }> = ({ tabs }) => {
  const [activeId, setActiveId] = React.useState<number | undefined>(tabs[0]?.id);
  if (tabs.length === 0) {
    return null;
  }
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  // A tab with an Icon set (e.g. Travel Entitlement's "Select Your Travel
  // Type") renders as a rich icon+title/subtitle/description+arrow selector
  // card instead of a plain label pill - opt-in, so a section that never
  // sets Icon on its tabs keeps the plain pill row unchanged.
  const rich = tabs.some((t) => t.icon !== undefined);
  return (
    <div>
      <div className={rich ? styles.tabSelectorList : styles.tabList} role="tablist">
        {tabs.map((tab) =>
          rich ? (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === active.id}
              className={`${styles.tabSelector} ${tab.id === active.id ? styles.tabSelectorActive : ''}`}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.icon !== undefined && (
                <span className={styles.tabSelectorIcon} aria-hidden="true">
                  <Icon iconName={tab.icon} />
                </span>
              )}
              <span className={styles.tabSelectorBody}>
                <span className={styles.tabSelectorTitle}>{tab.label}</span>
                {tab.subtitle !== undefined && <span className={styles.tabSelectorSubtitle}>{tab.subtitle}</span>}
                {tab.description !== undefined && <span className={styles.tabSelectorDescription}>{tab.description}</span>}
              </span>
              <Icon iconName="ChevronRight" className={styles.tabSelectorArrow} aria-hidden="true" />
            </button>
          ) : (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === active.id}
              className={`${styles.tabButton} ${tab.id === active.id ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.label}
            </button>
          )
        )}
      </div>
      <TabPanel tab={active} />
    </div>
  );
};

const CALLOUT_HEADING_RE = /^\*\*(.+?)\*\*\s*:?\s*(.*)$/;

/**
 * A callout/info-box notice inline within page content, e.g. "Important: …".
 * `body` written as `**Sub-heading:** rest of the text` bolds the leading
 * phrase, e.g. "Plan Early for Better Value".
 */
const Callout: React.FC<{ icon: string | undefined; body: string | undefined }> = ({ icon, body }) => {
  if (body === undefined || body.length === 0) {
    return null;
  }
  const match = CALLOUT_HEADING_RE.exec(body);
  return (
    <div className={styles.callout}>
      <Icon iconName={icon ?? 'Info'} aria-hidden="true" />
      <p className={styles.calloutBody}>
        {match !== null ? (
          <>
            <strong>{match[1]}: </strong>
            {match[2]}
          </>
        ) : (
          body
        )}
      </p>
    </div>
  );
};

const ImageBlock: React.FC<{ imageUrl: string | undefined; caption: string | undefined }> = ({ imageUrl, caption }) => {
  if (imageUrl === undefined) {
    return null;
  }
  return (
    <figure className={styles.imageBlock}>
      <ImageWithFallback src={imageUrl} alt={caption ?? ''} aspectRatio="16 / 9" className={styles.imageBlockMedia} />
      {caption !== undefined && <figcaption className={styles.imageBlockCaption}>{caption}</figcaption>}
    </figure>
  );
};

/** `linkItem` cards rendered as a row of link pills, e.g. reference documents. */
const LinksList: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <ul className={styles.linksList}>
      {cards.map((card) => (
        <li key={card.id}>
          <CardLink card={card} className={styles.linkItem}>
            <Icon iconName={card.icon} aria-hidden="true" /> {card.title || card.linkText} <Icon iconName="ChevronRight" aria-hidden="true" />
          </CardLink>
        </li>
      ))}
    </ul>
  );
};

/**
 * Renders one `IPolicySection` by its `layout` - the generic building block
 * `PolicyPageScreen` maps `data.sections` over. `cardVariant` only matters
 * for `cardsGrid` (which of the 3 card visual treatments to use); every
 * other layout has a single fixed treatment.
 */
export const PolicySectionBlock: React.FC<{ section: IPolicySection }> = ({ section }) => {
  // Opt-in: a `paragraph` section only takes this icon-left/tinted-background
  // treatment when it has an `Icon` set - no existing paragraph section has
  // one today (Icon is otherwise only used by `callout`/`imageBlock`), so
  // this only changes a section a content editor deliberately sets an icon
  // on (e.g. "Purpose" on the Purpose & Scope page), not paragraph sections
  // generally.
  if (section.layout === 'paragraph' && section.icon !== undefined) {
    return (
      <section className={styles.iconParagraphSection}>
        <span className={styles.iconParagraphIcon} aria-hidden="true">
          <Icon iconName={section.icon} />
        </span>
        <div className={styles.iconParagraphBody}>
          {section.title !== undefined && <h2 className={styles.sectionTitle}>{renderSectionTitle(section.title)}</h2>}
          {section.subtitle !== undefined && <p className={styles.sectionSubtitle}>{section.subtitle}</p>}
          <ParagraphBlock body={section.body} />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      {section.title !== undefined && <h2 className={styles.sectionTitle}>{renderSectionTitle(section.title)}</h2>}
      {section.subtitle !== undefined && <p className={styles.sectionSubtitle}>{section.subtitle}</p>}
      {renderLayout(section)}
    </section>
  );
};

function renderLayout(section: IPolicySection): React.ReactElement | undefined {
  switch (section.layout) {
    case 'paragraph':
      return <ParagraphBlock body={section.body} />;
    case 'cardsGrid':
      if (section.cardVariant === 'category') {
        return <CategoryCards cards={section.cards} />;
      }
      if (section.cardVariant === 'info') {
        return <InfoCards cards={section.cards} />;
      }
      return <HighlightCards cards={section.cards} sectionTitle={section.title} />;
    case 'table':
      return <TableBlock tables={section.tables} />;
    case 'tabs':
      return <TabsBlock tabs={section.tabs} />;
    case 'numberedSteps':
      return <RuleCards cards={section.cards} />;
    case 'processSteps':
      return <HelpSteps cards={section.cards} />;
    case 'callout':
      return <Callout icon={section.icon} body={section.body} />;
    case 'imageBlock':
      // `section.subtitle` already renders once in the shared section header
      // above - the caption uses `body` instead so it isn't shown twice.
      return <ImageBlock imageUrl={section.imageUrl} caption={section.body} />;
    case 'linksList':
      return <LinksList cards={section.cards} />;
    default:
      return undefined;
  }
}
