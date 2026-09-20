export type PolicyCardKind = 'category' | 'info' | 'highlight' | 'rule' | 'helpStep' | 'linkItem';

/** One repeatable content block on a policy page (from TH_PolicyCards). */
export interface IPolicyCard {
  id: number;
  kind: PolicyCardKind;
  /** Rule/HelpStep badge number, e.g. 1..8. `undefined` for kinds that don't number. */
  number: number | undefined;
  title: string;
  description: string;
  icon: string;
  iconColor: string | undefined;
  /** Newline-delimited sub-bullets, e.g. Rule cards' "Seasonal periods include" list. */
  subPoints: string[];
  /** Internal navigation (another TH_PolicyPages row), preferred over `linkUrl` when both are set. */
  targetSlug: string | undefined;
  /** Validated; `undefined` when invalid. */
  linkUrl: string | undefined;
  linkText: string | undefined;
  displayOrder: number;
}

/** One row of a `IPolicyTable` (from TH_PolicyTableRows). */
export interface IPolicyTableRow {
  id: number;
  /** One value per `IPolicyTable.columnHeaders`, same order. */
  cells: string[];
  displayOrder: number;
}

/** A simple data table inside a policy section, e.g. "Air Travel Entitlement" (from TH_PolicyTables). */
export interface IPolicyTable {
  id: number;
  /** Optional sub-heading, e.g. distinguishing several tables in the same section/tab. */
  title: string | undefined;
  columnHeaders: string[];
  rows: IPolicyTableRow[];
  displayOrder: number;
}

/** One tab of a `Layout: 'tabs'` section, e.g. "Business Travel" vs "Business Assignment" (from TH_PolicyTabs). */
export interface IPolicyTab {
  id: number;
  label: string;
  /** Optional, e.g. "Less than 30 days" under the "Business Travel" tab label. */
  subtitle: string | undefined;
  description: string | undefined;
  /** Optional selector icon; the tab renders as a plain pill button without it. */
  icon: string | undefined;
  cards: IPolicyCard[];
  tables: IPolicyTable[];
  displayOrder: number;
}

export type PolicySectionLayout =
  | 'paragraph'
  | 'cardsGrid'
  | 'table'
  | 'tabs'
  | 'numberedSteps'
  | 'processSteps'
  | 'callout'
  | 'imageBlock'
  | 'linksList';

/**
 * One ordered content block on a policy page (from TH_PolicySections). This
 * is the unit a content owner adds/reorders/removes to build up a page -
 * `PolicyPageScreen` renders `IPolicyPageContent.sections` in order, picking
 * the right visual treatment from `layout` (and `cardVariant` when
 * `layout === 'cardsGrid'`). See PolicyCardSections.tsx.
 */
export interface IPolicySection {
  id: number;
  title: string | undefined;
  subtitle: string | undefined;
  layout: PolicySectionLayout;
  /** Only meaningful when `layout === 'cardsGrid'` - picks which of the 3 card visual treatments to use. */
  cardVariant: 'category' | 'info' | 'highlight' | undefined;
  /** Free text for `layout === 'paragraph' | 'callout'`. */
  body: string | undefined;
  /** Decorative icon for `layout === 'callout' | 'imageBlock'`. */
  icon: string | undefined;
  /** For `layout === 'imageBlock'`. Validated; `undefined` when invalid/absent. */
  imageUrl: string | undefined;
  /** Cards not inside a tab - `cardsGrid` / `numberedSteps` / `processSteps` / `linksList`. */
  cards: IPolicyCard[];
  /** Tables not inside a tab - `layout === 'table'` (one or several stacked tables). */
  tables: IPolicyTable[];
  /** For `layout === 'tabs'` - each tab carries its own cards/tables. */
  tabs: IPolicyTab[];
  displayOrder: number;
}

/** A breadcrumb parent, denormalised (plain text, not a lookup) onto the child page row. */
export interface IPolicyPageParent {
  slug: string;
  title: string;
}

export interface IPolicyCta {
  title: string;
  description: string;
  linkText: string | undefined;
  linkUrl: string | undefined;
  primaryText: string | undefined;
  primaryUrl: string | undefined;
}

export interface IPolicyClosingBanner {
  title: string;
  description: string;
  /** Short decorative labels, e.g. "Our People" / "Our Planet" / "Our Future". */
  badges: string[];
}

/**
 * The "Need Help?" row every page carries. `email` is optional (a simple
 * contact line, e.g. the landing page); any `helpStep` cards render as a
 * numbered process below it (e.g. the benefits page's "Ask HR" 3 steps).
 */
export interface IPolicyNeedHelp {
  title: string;
  /** Small eyebrow label, e.g. "Contact Travel Services" / "ASK HR". */
  supportLabel: string | undefined;
  description: string;
  email: string | undefined;
  /**
   * The "Ask HR" style numbered process shown under this row, e.g. Annual
   * Flight Ticket Benefits' 3 steps (Create Ticket → Service Category →
   * Incident Category). Attached directly to the page (`TH_PolicyCards`
   * with `PageId` set, no `SectionId`/`TabId`) since it's a fixed page-level
   * feature, not a reorderable content block like `IPolicyPageContent.sections`.
   */
  steps: IPolicyCard[];
}

/** One page in the Travel Policy area (landing page included) — from TH_PolicyPages + TH_PolicySections + TH_PolicyCards/TH_PolicyTables/TH_PolicyTabs. */
export interface IPolicyPageContent {
  slug: string;
  title: string;
  parent: IPolicyPageParent | undefined;
  /**
   * A non-clickable breadcrumb crumb between `parent` and this page's title,
   * e.g. "Explore Policy Information" for the 6 policy sub-pages
   * (`Home > Travel Policy > Explore Policy Information > [Sub-page]`).
   */
  parentSectionLabel: string | undefined;
  hero: {
    icon: string | undefined;
    title: string;
    subtitle: string | undefined;
    description: string | undefined;
    imageUrl: string | undefined;
    tagline: string | undefined;
  };
  infoBannerText: string | undefined;
  noteBannerText: string | undefined;
  cta: IPolicyCta | undefined;
  needHelp: IPolicyNeedHelp | undefined;
  closingBanner: IPolicyClosingBanner | undefined;
  /** Decorative-only "Ask Policy Assistant" suggested questions, specific to this page. */
  suggestedQuestions: string[];
  /**
   * Optional "Ask a Question" CTA for the assistant block. When set, the
   * assistant renders as icon + title/description with this link as a
   * button (opens in a new tab) and the suggested questions below it - the
   * layout the 6 "Explore Policy Information" sub-pages use. Leave both
   * unset to keep the inline search-box layout (e.g. the Travel Policy
   * landing page).
   */
  assistantLinkUrl: string | undefined;
  assistantLinkText: string | undefined;
  /** Every content block on the page, in DisplayOrder. */
  sections: IPolicySection[];
}
