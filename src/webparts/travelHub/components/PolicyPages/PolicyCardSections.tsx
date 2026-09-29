import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { ImageWithFallback } from '../../../../common/components';
import { IPolicyCard, IPolicySection, IPolicyTable, IPolicyTab, PolicyCardStyle, PolicySectionWidth } from '../../../../models';
import { parseHighlightSubPoints, extractTag, ParsedSubPoint, IParseOptions } from './parseHighlightSubPoints';
import { renderRichText } from './richText';
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
      <a
        className={className}
        href={card.linkUrl}
        target={card.openInNewTab ? '_blank' : undefined}
        rel={card.openInNewTab ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

/** Whether a card has somewhere to go (in-app page or URL). */
function hasCardLink(card: IPolicyCard): boolean {
  return card.targetSlug !== undefined || card.linkUrl !== undefined;
}

/** An in-app page (slug) or a URL, as a button/anchor - used for section header links and hero buttons. */
export function PageLink({
  targetSlug,
  url,
  openInNewTab,
  className,
  children
}: {
  targetSlug: string | undefined;
  url: string | undefined;
  openInNewTab?: boolean;
  className: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { navigate } = useNavigation();
  if (targetSlug !== undefined) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => navigate(targetSlug === BUSINESS_TRAVEL_SLUG ? { kind: 'businessTravel' } : { kind: 'policyPage', slug: targetSlug })}
      >
        {children}
      </button>
    );
  }
  if (url !== undefined) {
    return (
      <a className={className} href={url} target={openInNewTab ? '_blank' : undefined} rel={openInNewTab ? 'noopener noreferrer' : undefined}>
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
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

type BulletBlock = Extract<ParsedSubPoint, { kind: 'bullet' | 'iconBullet' }>;
type SubPointGroup = { kind: 'bullets'; items: BulletBlock[] } | Exclude<ParsedSubPoint, BulletBlock>;

/** Merges consecutive bullet/iconBullet blocks into one list, keeping every block in authored order. */
function groupSubPoints(blocks: ParsedSubPoint[]): SubPointGroup[] {
  const groups: SubPointGroup[] = [];
  blocks.forEach((b) => {
    if (b.kind === 'bullet' || b.kind === 'iconBullet') {
      const last = groups[groups.length - 1];
      if (last !== undefined && last.kind === 'bullets') {
        last.items.push(b);
      } else {
        groups.push({ kind: 'bullets', items: [b] });
      }
    } else {
      groups.push(b);
    }
  });
  return groups;
}

/**
 * A card's parsed `SubPoints` (see parseHighlightSubPoints.ts), rendered in
 * the same order the lines are written - e.g. a `##` table followed by
 * bullets shows the table first.
 */
const SubPointsBlocks: React.FC<{ subPoints: string[]; options?: IParseOptions }> = ({ subPoints, options }) => {
  if (subPoints.length === 0) {
    return null;
  }
  const groups = groupSubPoints(parseHighlightSubPoints(subPoints, options));

  return (
    <>
      {groups.map((block, index) => {
        if (block.kind === 'bullets') {
          return (
            <ul key={index} className={styles.highlightSubPoints}>
              {block.items.map((b, i) =>
                b.kind === 'iconBullet' ? (
                  <li key={i} className={styles.highlightSubPointIconed}>
                    <Icon iconName={b.icon} aria-hidden="true" /> <span>{renderRichText(b.text)}</span>
                  </li>
                ) : (
                  <li key={i}>{renderRichText(b.text)}</li>
                )
              )}
            </ul>
          );
        }
        if (block.kind === 'heading') {
          return (
            <p key={index} className={styles.highlightSubHeading}>
              {block.text}
            </p>
          );
        }
        if (block.kind === 'paragraph') {
          return (
            <p key={index} className={styles.highlightParagraph}>
              {renderRichText(block.text)}
            </p>
          );
        }
        if (block.kind === 'table') {
          return (
            <div key={index} className={styles.highlightTableWrap}>
              <table className={styles.highlightTable}>
                <thead>
                  <tr>
                    {block.headers.map((h, i) => (
                      <th key={i} scope="col">
                        <TableCell value={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}>{c === 0 ? <TableCell value={cell} /> : renderRichText(cell)}</td>
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
                {renderRichText(block.text)}
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
                <p>{renderRichText(block.text)}</p>
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
                <span>{renderRichText(item)}</span>
              </li>
            ))}
          </ol>
        );
      })}
    </>
  );
};

/** "Key Policy Highlights" style — icon + title + description cards, e.g. comparison cards too. */
export interface IHighlightCardsProps {
  cards: IPolicyCard[];
  sectionTitle?: string;
  /** Cards per row (desktop); `undefined` = the responsive default grid. */
  columns?: number;
  /** `default` keeps the legacy look (incl. the title-matched icon-left sections). */
  cardStyle?: PolicyCardStyle;
  /** Tint each card with its own IconColor. */
  tintCards?: boolean;
}

/** A card-level title typed as "2. Employee Responsibilities" renders a number badge, coloured by the card's IconColor. */
function renderCardTitle(title: string, color: string | undefined): React.ReactNode {
  const match = SECTION_NUMBER_RE.exec(title);
  if (match === null) {
    return title;
  }
  return (
    <>
      <span className={styles.cardNumber} style={color !== undefined ? { backgroundColor: color } : undefined} aria-hidden="true">
        {match[1]}
      </span>
      {match[2]}
    </>
  );
}

function cardAccentStyle(card: IPolicyCard, tint: boolean): React.CSSProperties | undefined {
  return tint && card.iconColor !== undefined ? ({ '--th-card-accent': card.iconColor } as React.CSSProperties) : undefined;
}

export const HighlightCards: React.FC<IHighlightCardsProps> = ({ cards, sectionTitle, columns, cardStyle = 'default', tintCards = false }) => {
  if (cards.length === 0) {
    return null;
  }
  const iconLeft = sectionTitle !== undefined && ICON_LEFT_HEADER_SECTIONS.has(sectionTitle);
  const underlineTitle = iconLeft && sectionTitle !== undefined && UNDERLINE_TITLE_SECTIONS.has(sectionTitle);
  const gridClassName = columns !== undefined ? `${styles.highlightGrid} ${styles.highlightGridCols}` : styles.highlightGrid;
  const gridStyle = columns !== undefined ? ({ '--th-cols': String(columns) } as React.CSSProperties) : undefined;

  return (
    <div className={gridClassName} style={gridStyle}>
      {cards.map((card) => {
        // A leading `%%Tag` line in SubPoints (e.g. "Traveler" / "Approver")
        // becomes a header badge instead of body text - see parseHighlightSubPoints.ts.
        const { tag, rest } = extractTag(card.subPoints);
        const cardClassName = `${styles.highlightCard} ${tintCards && card.iconColor !== undefined ? styles.highlightCardTinted : ''}`;
        const accent = cardAccentStyle(card, tintCards);
        const softIcon = (tintCards || cardStyle !== 'default') && card.iconColor !== undefined;
        const iconStyle =
          card.iconColor === undefined
            ? undefined
            : softIcon
              ? { backgroundColor: `color-mix(in srgb, ${card.iconColor} 15%, transparent)`, color: card.iconColor }
              : { backgroundColor: card.iconColor };

        // Opt-in layouts (TH_PolicySections.CardStyle) - the icon only shows
        // when the card's Icon column is actually filled in.
        if (cardStyle === 'iconHeader' || cardStyle === 'iconMedia') {
          const icon = card.iconExplicit ? (
            <span className={cardStyle === 'iconMedia' ? styles.highlightMediaIcon : styles.highlightIcon} style={iconStyle} aria-hidden="true">
              <Icon iconName={card.icon} />
            </span>
          ) : null;
          const title = card.title.length > 0 ? <h3 className={styles.highlightTitle}>{renderCardTitle(card.title, card.iconColor)}</h3> : null;
          const tagBadge = tag !== undefined ? <span className={styles.highlightHeaderTag}>{tag}</span> : null;
          const body = (
            <>
              {card.description.length > 0 && <p className={styles.highlightDescription}>{renderRichText(card.description)}</p>}
              <SubPointsBlocks subPoints={rest} />
              {card.linkText !== undefined && hasCardLink(card) && (
                <CardLink card={card} className={styles.featureLink}>
                  {card.linkText} <Icon iconName="ArrowRight" aria-hidden="true" />
                </CardLink>
              )}
            </>
          );
          if (cardStyle === 'iconMedia') {
            return (
              <div key={card.id} className={`${cardClassName} ${styles.highlightCardMedia}`} style={accent}>
                {icon}
                <div className={styles.highlightMediaBody}>
                  <div className={styles.highlightHeaderRow}>
                    {title}
                    {tagBadge}
                  </div>
                  {body}
                </div>
              </div>
            );
          }
          return (
            <div key={card.id} className={cardClassName} style={accent}>
              <div className={styles.highlightHeaderRow}>
                {icon}
                {title}
                {tagBadge}
              </div>
              {body}
            </div>
          );
        }

        const titleClassName = underlineTitle ? `${styles.highlightTitle} ${styles.highlightTitleUnderline}` : styles.highlightTitle;
        const titleStyle = underlineTitle && card.iconColor !== undefined ? { borderColor: card.iconColor } : undefined;
        return (
          <div key={card.id} className={cardClassName} style={accent}>
            {tag !== undefined && <span className={styles.highlightTag}>{tag}</span>}
            {iconLeft ? (
              <div className={styles.highlightHeaderRow}>
                <span className={styles.highlightIcon} style={iconStyle} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
                <h3 className={titleClassName} style={titleStyle}>
                  {card.title}
                </h3>
              </div>
            ) : (
              <>
                <span className={styles.highlightIcon} style={iconStyle} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
                <h3 className={styles.highlightTitle}>{card.title}</h3>
              </>
            )}
            {card.description.length > 0 && <p className={styles.highlightDescription}>{renderRichText(card.description)}</p>}
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
 * A card with BOTH a Number and an Icon filled in shows the icon in the
 * badge and the number before its title ("1. Check Eligibility").
 */
/** A stacked step with only a title (no text/points/image) - drawn compact: icon, number, label, no box. */
function isCompactStep(card: IPolicyCard): boolean {
  return card.description.length === 0 && card.subPoints.length === 0 && card.imageUrl === undefined;
}

export const HelpSteps: React.FC<{ cards: IPolicyCard[]; oneRow?: boolean; stacked?: boolean }> = ({ cards, oneRow = false, stacked = false }) => {
  if (cards.length === 0) {
    return null;
  }
  if (stacked) {
    // CardStyle = Stacked: each step a column - number badge, icon circle,
    // title, text, optional image (SAP Concur "How It Works").
    return (
      <ol className={styles.stackedSteps}>
        {cards.map((card, index) => (
          <React.Fragment key={card.id}>
            <li
              className={`${styles.stackedStep} ${isCompactStep(card) ? styles.stackedStepCompact : ''}`}
              style={card.iconColor !== undefined ? ({ '--th-card-accent': card.iconColor } as React.CSSProperties) : undefined}
            >
              <div className={styles.stackedStepTop}>
                {card.number !== undefined && <span className={styles.stackedStepNumber}>{card.number}</span>}
                <span className={styles.stackedStepIcon} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
              </div>
              <div className={styles.stackedStepTitle}>{card.title}</div>
              {card.subtitle !== undefined && <div className={styles.stackedStepSubtitle}>{card.subtitle}</div>}
              {card.description.length > 0 && <div className={styles.helpStepDescription}>{renderRichText(card.description)}</div>}
              <SubPointsBlocks subPoints={card.subPoints} />
              {card.imageUrl !== undefined && <img className={styles.stackedStepImage} src={card.imageUrl} alt="" loading="lazy" />}
            </li>
            {index < cards.length - 1 && <Icon iconName="ChevronRight" className={styles.helpStepArrow} aria-hidden="true" />}
          </React.Fragment>
        ))}
      </ol>
    );
  }
  return (
    <ol className={`${styles.helpSteps} ${oneRow ? styles.helpStepsRow : ''}`}>
      {cards.map((card, index) => {
        const iconAndNumber = card.number !== undefined && card.iconExplicit;
        const showNumber = card.number !== undefined && !iconAndNumber;
        return (
          <React.Fragment key={card.id}>
            <li className={styles.helpStep}>
              <span className={`${styles.helpStepNumber} ${showNumber ? '' : styles.helpStepIconBadge}`}>
                {showNumber ? card.number : <Icon iconName={card.icon} aria-hidden="true" />}
              </span>
              <div>
                <div className={styles.helpStepTitle}>{iconAndNumber ? `${String(card.number)}. ${card.title}` : card.title}</div>
                {card.description.length > 0 && <div className={styles.helpStepDescription}>{renderRichText(card.description)}</div>}
              </div>
            </li>
            {index < cards.length - 1 && <Icon iconName="ChevronRight" className={styles.helpStepArrow} aria-hidden="true" />}
          </React.Fragment>
        );
      })}
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
                      <TableCell value={header} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => (
                      <td key={index}>{index === 0 ? <TableCell value={cell} /> : renderRichText(cell)}</td>
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

/**
 * `Layout: 'split'` - the section's cards side by side, separated by vertical
 * lines (stacked on phones), e.g. "Expense Reimbursement Principles" or the
 * 4-part "Important Assignment Information". Each part: its icon (only when
 * the card's Icon is filled in) on the left; title, description, SubPoints and
 * an optional link on the right. A `LinkItem` card is a compact trailing part,
 * e.g. "Need help deciding? Contact Travel Services".
 */
const SplitBlock: React.FC<{ cards: IPolicyCard[]; compact?: boolean }> = ({ cards, compact = false }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className={`${styles.split} ${compact ? styles.splitCompact : ''}`}>
      {cards.map((card) => {
        const hasLink = card.linkText !== undefined && (card.targetSlug !== undefined || card.linkUrl !== undefined);
        return (
          <div key={card.id} className={`${styles.splitPart} ${card.kind === 'linkItem' ? styles.splitPartTrailing : ''}`}>
            {card.imageUrl !== undefined ? (
              <img className={styles.splitImage} src={card.imageUrl} alt={card.title} loading="lazy" />
            ) : (
              card.iconExplicit && (
                <span className={styles.splitIcon} style={card.iconColor !== undefined ? { color: card.iconColor } : undefined} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
              )
            )}
            <div className={styles.splitBody}>
              {card.title.length > 0 && <p className={styles.splitTitle}>{card.title}</p>}
              {card.description.length > 0 && <p className={styles.splitDescription}>{renderRichText(card.description)}</p>}
              <SubPointsBlocks subPoints={card.subPoints} />
              {hasLink && (
                <CardLink card={card} className={styles.splitLink}>
                  {card.linkText} <Icon iconName="ChevronRight" aria-hidden="true" />
                </CardLink>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * `Layout: 'checklist'` - a row of check-marked items separated by vertical
 * lines, e.g. "Before You Travel - Quick Compliance Check". Items are the
 * section's `Body` lines, or its cards' titles when Body is empty.
 */
const ChecklistBlock: React.FC<{ section: IPolicySection }> = ({ section }) => {
  const fromBody = (section.body ?? '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const items = fromBody.length > 0 ? fromBody : section.cards.map((c) => c.title).filter((t) => t.length > 0);
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className={styles.checklist}>
      {items.map((item, index) => (
        <li key={index} className={styles.checklistItem}>
          <span className={styles.checklistCheck} aria-hidden="true">
            <Icon iconName="CheckMark" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

/**
 * `Layout: 'banner'` - a header band: icon, title and subtitle on the left,
 * a script tagline (the section's `Body`, one line per row) on the right,
 * e.g. "Business Travel Entitlements (Less than 30 days)" inside a tab.
 */
const BannerBlock: React.FC<{ section: IPolicySection }> = ({ section }) => {
  const tagline = (section.body ?? '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return (
    <div className={styles.banner}>
      {section.icon !== undefined && (
        <span className={styles.bannerIcon} aria-hidden="true">
          <Icon iconName={section.icon} />
        </span>
      )}
      <div className={styles.bannerText}>
        {section.title !== undefined && <h2 className={styles.bannerTitle}>{renderSectionTitle(section.title)}</h2>}
        {section.subtitle !== undefined && <p className={styles.bannerSubtitle}>{section.subtitle}</p>}
      </div>
      {tagline.length > 0 && (
        <p className={styles.bannerTagline}>
          {tagline.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </p>
      )}
    </div>
  );
};

/**
 * One tab's content. A tab with nested sections (TH_PolicySections rows with
 * TabId = this tab) renders them like a mini page - banner, card grid, split
 * row, … Otherwise the legacy content: its own tables, then its own cards.
 */
const TabPanel: React.FC<{ tab: IPolicyTab }> = ({ tab }) => (
  <div className={styles.tabPanel} role="tabpanel">
    {tab.sections.length > 0 ? (
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutual recursion: a tab's sections are rendered by the same block component.
      <SectionFlow sections={tab.sections} />
    ) : (
      <>
        <TableBlock tables={tab.tables} />
        <HighlightCards cards={tab.cards} />
      </>
    )}
  </div>
);

/**
 * A `Layout: 'tabs'` section, e.g. "Business Travel" vs "Business Assignment"
 * entitlements. Cards attached directly to the tabs section itself (not to a
 * tab) render as a split information bar between the selector and the tab
 * content, e.g. "Not sure which category applies? | Need help deciding?".
 */
const TabsBlock: React.FC<{ tabs: IPolicyTab[]; infoCards?: IPolicyCard[] }> = ({ tabs, infoCards = [] }) => {
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
    <div className={styles.tabsBlock}>
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
      {infoCards.length > 0 && <SplitBlock cards={infoCards} compact />}
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
            {renderRichText(match[2])}
          </>
        ) : (
          renderRichText(body)
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

/** A multi-line text field, one entry per non-empty line. */
function splitBody(body: string | undefined): string[] {
  return (body ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** "Starting From / SAR 5,999 / per person" - a card's Value with its two captions. */
const ValueBlock: React.FC<{ card: IPolicyCard; className?: string }> = ({ card, className }) =>
  card.value === undefined ? null : (
    <div className={`${styles.valueBlock} ${className ?? ''}`}>
      {card.valueLabel !== undefined && <span className={styles.valueLabel}>{card.valueLabel}</span>}
      <span className={styles.valueFigure}>{card.value}</span>
      {card.valueNote !== undefined && <span className={styles.valueNote}>{card.valueNote}</span>}
    </div>
  );

/** The card's own colour as a CSS variable (buttons, icon discs, tints). */
function accentVar(card: IPolicyCard): React.CSSProperties | undefined {
  return card.iconColor !== undefined ? ({ '--th-card-accent': card.iconColor } as React.CSSProperties) : undefined;
}

/**
 * `Layout: 'imageCards'` - photo cards. `CardStyle` picks the look:
 * - `ImageTop` (default): photo with an optional Badge pill and icon disc,
 *   then title, subtitle, description, SubPoints, Value and a button
 *   (LinkText) - offers, partnered hotels, "Business Travel & Mobility".
 * - `ImageTile`: compact tile - photo (or icon), icon disc, title, arrow -
 *   category tiles; with no ImageUrl an icon tile ("Key Policy Highlights").
 * - `ImageBanner`: big photo with the text over it - destination and meeting
 *   room banners.
 * - `ImageLeft`: photo (or icon) on the left, text and an arrow on the right -
 *   link cards ("Accommodation & Site Services", "More Details").
 * The whole card is the link (TargetSlug / LinkUrl). `Columns` sets cards per row.
 */
const ImageCards: React.FC<{ cards: IPolicyCard[]; columns: number | undefined; cardStyle: PolicyCardStyle }> = ({ cards, columns, cardStyle }) => {
  if (cards.length === 0) {
    return null;
  }
  const look = cardStyle === 'imageTile' || cardStyle === 'imageBanner' || cardStyle === 'imageLeft' ? cardStyle : 'imageTop';
  const gridClass = {
    imageTop: styles.imageCardsTop,
    imageTile: styles.imageCardsTile,
    imageBanner: styles.imageCardsBanner,
    imageLeft: styles.imageCardsLeft
  }[look];
  const gridStyle = columns !== undefined ? ({ '--th-cols': String(columns) } as React.CSSProperties) : undefined;

  return (
    <div className={`${styles.imageCards} ${gridClass} ${columns !== undefined ? styles.imageCardsCols : ''}`} style={gridStyle}>
      {cards.map((card) => {
        const iconDisc = card.iconExplicit ? (
          <span className={styles.imageCardIcon} aria-hidden="true">
            <Icon iconName={card.icon} />
          </span>
        ) : null;
        const cardClass = `${styles.imageCard} ${hasCardLink(card) ? styles.imageCardLinked : ''}`;

        if (look === 'imageBanner') {
          return (
            <CardLink key={card.id} card={card} className={`${cardClass} ${styles.imageCardBanner}`}>
              {card.imageUrl !== undefined && <img className={styles.imageCardBannerImg} src={card.imageUrl} alt="" loading="lazy" />}
              <span className={styles.imageCardBannerContent} style={accentVar(card)}>
                {card.badge !== undefined && <span className={styles.imageCardEyebrow}>{card.badge}</span>}
                <span className={styles.imageCardBannerTitle}>
                  {card.title} {card.linkText === undefined && hasCardLink(card) && <Icon iconName="ArrowRight" aria-hidden="true" />}
                </span>
                {card.subtitle !== undefined && <span className={styles.imageCardBannerSub}>{card.subtitle}</span>}
                {card.description.length > 0 && <span className={styles.imageCardBannerText}>{card.description}</span>}
                {card.linkText !== undefined && (
                  <span className={styles.imageCardButton}>
                    {card.linkText} <Icon iconName="ArrowRight" aria-hidden="true" />
                  </span>
                )}
              </span>
            </CardLink>
          );
        }

        if (look === 'imageLeft') {
          return (
            <CardLink key={card.id} card={card} className={`${cardClass} ${styles.imageCardLeft}`}>
              {card.imageUrl !== undefined ? (
                <span className={styles.imageCardLeftMedia}>
                  <img src={card.imageUrl} alt="" loading="lazy" />
                  {iconDisc}
                </span>
              ) : (
                <span className={styles.imageCardLeftIcon} style={accentVar(card)} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
              )}
              <span className={styles.imageCardBody}>
                <span className={styles.imageCardTitle}>{card.title}</span>
                {card.subtitle !== undefined && <span className={styles.imageCardSubtitle}>{card.subtitle}</span>}
                {card.description.length > 0 && <span className={styles.imageCardText}>{renderRichText(card.description)}</span>}
              </span>
              {hasCardLink(card) && (
                <span className={styles.imageCardArrow} style={accentVar(card)} aria-hidden="true">
                  <Icon iconName="ChevronRight" />
                </span>
              )}
            </CardLink>
          );
        }

        if (look === 'imageTile') {
          return (
            <CardLink key={card.id} card={card} className={`${cardClass} ${styles.imageCardTile}`}>
              {card.imageUrl !== undefined ? (
                <span className={styles.imageCardMedia}>
                  <img src={card.imageUrl} alt="" loading="lazy" />
                  {iconDisc !== null && <span className={styles.imageCardIconAnchor} style={accentVar(card)}>{iconDisc}</span>}
                </span>
              ) : (
                <span className={styles.imageCardTileIcon} style={accentVar(card)} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
              )}
              <span className={styles.imageCardTileFooter}>
                <span className={styles.imageCardTitle}>{card.title}</span>
                {hasCardLink(card) && (
                  <span className={styles.imageCardArrow} style={accentVar(card)} aria-hidden="true">
                    <Icon iconName="ChevronRight" />
                  </span>
                )}
              </span>
            </CardLink>
          );
        }

        // imageTop
        return (
          <CardLink key={card.id} card={card} className={`${cardClass} ${styles.imageCardTop}`}>
            {card.imageUrl !== undefined ? (
              <span className={styles.imageCardMedia}>
                <img src={card.imageUrl} alt="" loading="lazy" />
                {card.badge !== undefined && <span className={styles.imageCardBadge} style={accentVar(card)}>{card.badge}</span>}
                {iconDisc !== null && <span className={styles.imageCardIconAnchor} style={accentVar(card)}>{iconDisc}</span>}
              </span>
            ) : (
              iconDisc !== null && (
                <span className={styles.imageCardTopIcon} style={accentVar(card)}>
                  {iconDisc}
                </span>
              )
            )}
            <span className={styles.imageCardBody} style={accentVar(card)}>
              <span className={styles.imageCardTitle}>{card.title}</span>
              {card.subtitle !== undefined && <span className={styles.imageCardSubtitle}>{card.subtitle}</span>}
              {card.description.length > 0 && <span className={styles.imageCardText}>{renderRichText(card.description)}</span>}
              {card.subPoints.length > 0 && (
                <span className={styles.imageCardPoints}>
                  <SubPointsBlocks subPoints={card.subPoints} />
                </span>
              )}
              <ValueBlock card={card} />
              {card.linkText !== undefined && (
                <span
                  className={
                    card.imageUrl === undefined
                      ? styles.featureLink
                      : card.iconExplicit
                        ? styles.imageCardButton
                        : `${styles.imageCardButton} ${styles.imageCardButtonOutline}`
                  }
                >
                  {card.linkText} <Icon iconName="ArrowRight" aria-hidden="true" />
                </span>
              )}
            </span>
          </CardLink>
        );
      })}
    </div>
  );
};

/**
 * `Layout: 'feature'` - one rich panel: the section's Icon in a disc, Title,
 * Subtitle and Body (free text: one paragraph per line, `- ` bullets, and
 * every SubPoints marker - `##` tables, `!!` notes, `@Icon|…`, `==` headings),
 * then its cards - a card with a Value is a figure tile ("Up to SAR 25,000"),
 * any other card a small info card - and ImageUrl as a photo on the right
 * (CardStyle = ImageLeft puts it on the left). E.g. the relocation pages'
 * "Shipping Assistance", "Transportation"; SAP Concur's "Discover Joule".
 */
const FeatureBlock: React.FC<{ section: IPolicySection }> = ({ section }) => {
  const stats = section.cards.filter((c) => c.value !== undefined);
  const infos = section.cards.filter((c) => c.value === undefined);
  const imageLeft = section.cardStyle === 'imageLeft';
  return (
    <div className={`${styles.feature} ${imageLeft ? styles.featureImageLeft : ''} ${section.imageUrl !== undefined ? styles.featureWithImage : ''}`}>
      <div className={styles.featureMain}>
        {section.icon !== undefined && (
          <span className={styles.featureIcon} aria-hidden="true">
            <Icon iconName={section.icon} />
          </span>
        )}
        <div className={styles.featureBody}>
          {section.title !== undefined && <h2 className={styles.featureTitle}>{renderSectionTitle(section.title)}</h2>}
          {section.subtitle !== undefined && <p className={styles.featureSubtitle}>{section.subtitle}</p>}
          <SubPointsBlocks subPoints={splitBody(section.body)} options={{ plainAs: 'paragraph' }} />
          {section.linkText !== undefined && (section.targetSlug !== undefined || section.linkUrl !== undefined) && (
            <PageLink
              targetSlug={section.targetSlug}
              url={section.linkUrl}
              openInNewTab={section.linkUrl !== undefined && /^https?:/i.test(section.linkUrl)}
              className={styles.sectionHeaderLink}
            >
              {section.linkText} <Icon iconName="ArrowRight" aria-hidden="true" />
            </PageLink>
          )}
          {infos.length > 0 && (
            <div className={styles.featureInfos}>
              {infos.map((card) => (
                <CardLink key={card.id} card={card} className={styles.featureInfo}>
                  {card.iconExplicit && (
                    <span className={styles.featureInfoIcon} style={accentVar(card)} aria-hidden="true">
                      <Icon iconName={card.icon} />
                    </span>
                  )}
                  <span className={styles.imageCardBody}>
                    {card.title.length > 0 && <span className={styles.imageCardTitle}>{card.title}</span>}
                    {card.subtitle !== undefined && <span className={styles.imageCardSubtitle}>{card.subtitle}</span>}
                    {card.description.length > 0 && <span className={styles.imageCardText}>{renderRichText(card.description)}</span>}
                    {card.subPoints.length > 0 && <SubPointsBlocks subPoints={card.subPoints} />}
                    {card.linkText !== undefined && (
                      <span className={styles.featureLink}>
                        {card.linkText} <Icon iconName="ArrowRight" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                </CardLink>
              ))}
            </div>
          )}
        </div>
      </div>
      {stats.length > 0 && (
        <div className={styles.featureStats}>
          {stats.map((card) => (
            <div key={card.id} className={styles.featureStat} style={accentVar(card)}>
              {card.iconExplicit && (
                <span className={styles.featureStatIcon} aria-hidden="true">
                  <Icon iconName={card.icon} />
                </span>
              )}
              <ValueBlock card={card} />
              {card.description.length > 0 && <span className={styles.valueNote}>{card.description}</span>}
            </div>
          ))}
        </div>
      )}
      {section.imageUrl !== undefined && <img className={styles.featureImage} src={section.imageUrl} alt="" loading="lazy" />}
    </div>
  );
};

/**
 * `Layout: 'faq'` - numbered question rows. Title = the question; a card with
 * a Description (and/or SubPoints) expands to show it; a card with only a link
 * (TargetSlug / LinkUrl) is a plain link row instead.
 */
const FaqBlock: React.FC<{ cards: IPolicyCard[] }> = ({ cards }) => {
  const [openId, setOpenId] = React.useState<number | undefined>(undefined);
  if (cards.length === 0) {
    return null;
  }
  return (
    <ol className={styles.faq}>
      {cards.map((card, index) => {
        const hasAnswer = card.description.length > 0 || card.subPoints.length > 0;
        const open = openId === card.id;
        const row = (
          <>
            <span className={styles.faqNumber}>{card.number ?? index + 1}</span>
            <span className={styles.faqQuestion}>{card.title}</span>
            <Icon iconName={hasAnswer ? (open ? 'ChevronUp' : 'ChevronDown') : 'ChevronRight'} className={styles.faqChevron} aria-hidden="true" />
          </>
        );
        return (
          <li key={card.id} className={styles.faqItem}>
            {hasAnswer ? (
              <button type="button" className={styles.faqRow} aria-expanded={open} onClick={() => setOpenId(open ? undefined : card.id)}>
                {row}
              </button>
            ) : (
              <CardLink card={card} className={styles.faqRow}>
                {row}
              </CardLink>
            )}
            {hasAnswer && open && (
              <div className={styles.faqAnswer}>
                {card.description.length > 0 && <p className={styles.highlightDescription}>{renderRichText(card.description)}</p>}
                <SubPointsBlocks subPoints={card.subPoints} />
                {hasCardLink(card) && card.linkText !== undefined && (
                  <CardLink card={card} className={styles.featureLink}>
                    {card.linkText} <Icon iconName="ArrowRight" aria-hidden="true" />
                  </CardLink>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

/**
 * `Layout: 'search'` - a search box plus quick-link pills. The search opens
 * the section's LinkUrl in a new tab with the typed words: `{query}` in the
 * URL is replaced by them, otherwise `?q=…` is appended. Subtitle = the
 * placeholder text, Body = the quick-links label (default "Quick links:"),
 * cards = the pills (Title/LinkText + TargetSlug/LinkUrl).
 */
const SearchBlock: React.FC<{ section: IPolicySection }> = ({ section }) => {
  const [query, setQuery] = React.useState('');
  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const q = query.trim();
    if (q.length === 0 || section.linkUrl === undefined) {
      return;
    }
    const encoded = encodeURIComponent(q);
    const url =
      section.linkUrl.indexOf('{query}') >= 0
        ? section.linkUrl.replace('{query}', encoded)
        : `${section.linkUrl}${section.linkUrl.indexOf('?') >= 0 ? '&' : '?'}q=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className={styles.search}>
      <form className={styles.searchForm} onSubmit={submit} role="search">
        <Icon iconName="Search" className={styles.searchIcon} aria-hidden="true" />
        <input
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={section.subtitle ?? 'Search…'}
          aria-label={section.title ?? section.subtitle ?? 'Search'}
        />
        <button type="submit" className={styles.searchButton}>
          {section.linkText ?? 'Search'}
        </button>
      </form>
      {section.cards.length > 0 && (
        <div className={styles.searchQuick}>
          <span className={styles.searchQuickLabel}>{section.body ?? 'Quick links:'}</span>
          {section.cards.map((card) => (
            <CardLink key={card.id} card={card} className={styles.searchPill}>
              {card.title || card.linkText}
            </CardLink>
          ))}
        </div>
      )}
    </div>
  );
};

const WIDTH_SPAN: Record<PolicySectionWidth, number> = { full: 12, half: 6, oneThird: 4, twoThirds: 8 };

/**
 * Renders sections in order; consecutive sections whose Width is not Full
 * share a row (e.g. Half + Half, TwoThirds + OneThird), stacked on smaller
 * screens. With every Width left at Full this is exactly the old stack.
 */
export const SectionFlow: React.FC<{ sections: IPolicySection[] }> = ({ sections }) => {
  const rows: IPolicySection[][] = [];
  let current: IPolicySection[] = [];
  let used = 0;
  sections.forEach((section) => {
    const span = WIDTH_SPAN[section.width];
    if (span === 12) {
      if (current.length > 0) {
        rows.push(current);
        current = [];
        used = 0;
      }
      rows.push([section]);
      return;
    }
    if (used + span > 12) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(section);
    used += span;
  });
  if (current.length > 0) {
    rows.push(current);
  }

  return (
    <>
      {rows.map((row) =>
        row.length === 1 && row[0].width === 'full' ? (
          // eslint-disable-next-line @typescript-eslint/no-use-before-define -- the block component is defined below.
          <PolicySectionBlock key={row[0].id} section={row[0]} />
        ) : (
          <div
            key={row[0].id}
            className={styles.sectionRow}
            style={{ '--th-row-cols': row.map((s) => `${String(WIDTH_SPAN[s.width])}fr`).join(' ') } as React.CSSProperties}
          >
            {row.map((section) => (
              <div key={section.id} className={styles.sectionRowCell}>
                {/* eslint-disable-next-line @typescript-eslint/no-use-before-define -- the block component is defined below. */}
                <PolicySectionBlock section={section} />
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
};

/** Layouts that render their own header or none (the icon is not repeated before the title). */
const SELF_HEADED_LAYOUTS: ReadonlySet<string> = new Set(['callout', 'imageBlock', 'banner', 'feature', 'search']);

/** Layouts that don't use `Body` themselves - for these, `Body` is a short note at the right of the section header. */
const HEADER_NOTE_LAYOUTS: ReadonlySet<string> = new Set(['cardsGrid', 'imageCards', 'processSteps', 'split', 'tabs', 'table', 'linksList', 'faq', 'numberedSteps']);

/** CSS classes for the opt-in section container (TH_PolicySections.SectionStyle). */
function sectionContainerClass(section: IPolicySection, base: string): string {
  if (section.sectionStyle === 'card') {
    return `${base} ${styles.sectionCard}`;
  }
  if (section.sectionStyle === 'tinted') {
    return `${base} ${styles.sectionTinted}`;
  }
  return base;
}

/**
 * Renders one `IPolicySection` by its `layout` - the generic building block
 * `PolicyPageScreen` maps `data.sections` over. `cardVariant` only matters
 * for `cardsGrid` (which of the 3 card visual treatments to use); every
 * other layout has a single fixed treatment. `sectionStyle`/`theme` wrap it in
 * an optional card or tinted panel; left at their defaults nothing changes.
 */
export const PolicySectionBlock: React.FC<{ section: IPolicySection }> = ({ section }) => {
  const themeAttr = section.theme !== undefined ? { 'data-th-theme': section.theme } : {};

  // Opt-in: a `paragraph` section only takes this icon-left card treatment
  // when it has an `Icon` set (e.g. "Purpose" on the Purpose & Scope page),
  // not paragraph sections generally.
  if (section.layout === 'paragraph' && section.icon !== undefined) {
    return (
      <section className={sectionContainerClass(section, styles.iconParagraphSection)} {...themeAttr}>
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

  const selfHeaded = SELF_HEADED_LAYOUTS.has(section.layout);
  const headerIcon = section.icon !== undefined && section.layout !== 'paragraph' && !selfHeaded;
  const headerNote = HEADER_NOTE_LAYOUTS.has(section.layout) && section.body !== undefined ? section.body : undefined;
  const headerLink = section.linkText !== undefined && (section.targetSlug !== undefined || section.linkUrl !== undefined);
  const showHeader =
    !selfHeaded && (section.title !== undefined || section.subtitle !== undefined || headerNote !== undefined || headerLink);
  // Unchanged markup for a section that uses no header note / link.
  const plainHeader = !headerNote && !headerLink;

  const titleBlock = (
    <>
      {section.title !== undefined && <h2 className={styles.sectionTitle}>{renderSectionTitle(section.title)}</h2>}
      {section.subtitle !== undefined && <p className={styles.sectionSubtitle}>{section.subtitle}</p>}
    </>
  );
  const iconTitle = headerIcon ? (
    <div className={styles.sectionHeaderRow}>
      <span className={styles.sectionHeaderIcon} aria-hidden="true">
        <Icon iconName={section.icon} />
      </span>
      <div className={styles.sectionHeaderText}>{titleBlock}</div>
    </div>
  ) : null;

  return (
    <section className={sectionContainerClass(section, styles.section)} {...themeAttr}>
      {showHeader &&
        (plainHeader ? (
          iconTitle ?? titleBlock
        ) : (
          <div className={styles.sectionHeaderBar}>
            <div className={styles.sectionHeaderText}>{iconTitle ?? titleBlock}</div>
            <div className={styles.sectionHeaderAside}>
              {headerNote !== undefined && (
                <div className={styles.sectionHeaderNote}>
                  <SubPointsBlocks subPoints={splitBody(headerNote)} options={{ plainAs: 'paragraph' }} />
                </div>
              )}
              {headerLink && (
                <PageLink
                  targetSlug={section.targetSlug}
                  url={section.linkUrl}
                  openInNewTab={section.linkUrl !== undefined && /^https?:/i.test(section.linkUrl)}
                  className={styles.sectionHeaderLink}
                >
                  {section.linkText} <Icon iconName="ChevronRight" aria-hidden="true" />
                </PageLink>
              )}
            </div>
          </div>
        ))}
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
      return (
        <HighlightCards
          cards={section.cards}
          sectionTitle={section.title}
          columns={section.columns}
          cardStyle={section.cardStyle}
          tintCards={section.tintCards}
        />
      );
    case 'table':
      return <TableBlock tables={section.tables} />;
    case 'tabs':
      return <TabsBlock tabs={section.tabs} infoCards={section.cards} />;
    case 'numberedSteps':
      return <RuleCards cards={section.cards} />;
    case 'processSteps':
      return <HelpSteps cards={section.cards} oneRow stacked={section.cardStyle === 'stacked'} />;
    case 'callout':
      return <Callout icon={section.icon} body={section.body} />;
    case 'imageBlock':
      // `section.subtitle` already renders once in the shared section header
      // above - the caption uses `body` instead so it isn't shown twice.
      return <ImageBlock imageUrl={section.imageUrl} caption={section.body} />;
    case 'linksList':
      return <LinksList cards={section.cards} />;
    case 'split':
      return <SplitBlock cards={section.cards} />;
    case 'checklist':
      return <ChecklistBlock section={section} />;
    case 'banner':
      return <BannerBlock section={section} />;
    case 'imageCards':
      return <ImageCards cards={section.cards} columns={section.columns} cardStyle={section.cardStyle} />;
    case 'feature':
      return <FeatureBlock section={section} />;
    case 'faq':
      return <FaqBlock cards={section.cards} />;
    case 'search':
      return <SearchBlock section={section} />;
    default:
      return undefined;
  }
}
