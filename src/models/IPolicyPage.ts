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
  /** True when the card's `Icon` column was actually filled in (`icon` falls back to 'Info' otherwise). */
  iconExplicit: boolean;
  iconColor: string | undefined;
  /** Newline-delimited sub-bullets, e.g. Rule cards' "Seasonal periods include" list. */
  subPoints: string[];
  /** Internal navigation (another TH_PolicyPages row), preferred over `linkUrl` when both are set. */
  targetSlug: string | undefined;
  /** Validated; `undefined` when invalid. */
  linkUrl: string | undefined;
  linkText: string | undefined;
  /** Open `linkUrl` in a new tab. */
  openInNewTab: boolean;
  /** Validated card image (ImageCards photo, a Split part's QR code, …); `undefined` = none. */
  imageUrl: string | undefined;
  /** Small line under the title, e.g. "5 Nights Holiday Package" / "Riyadh, KSA". */
  subtitle: string | undefined;
  /** Pill over the image / next to the title, e.g. "Special Offer". */
  badge: string | undefined;
  /** A highlighted figure, e.g. "SAR 5,999" / "48 hours" / "SAR 25,000". */
  value: string | undefined;
  /** Small caption above `value`, e.g. "Starting From" / "Up to". */
  valueLabel: string | undefined;
  /** Small caption below `value`, e.g. "per person" / "Shipping Assistance". */
  valueNote: string | undefined;
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
  /**
   * Sections nested inside this tab (TH_PolicySections rows with `TabId` set).
   * When present they replace the tab's own cards/tables as its content, so
   * a tab can hold a banner, a card grid, a split row, … like a mini page.
   */
  sections: IPolicySection[];
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
  | 'linksList'
  | 'split'
  | 'checklist'
  | 'banner'
  | 'imageCards'
  | 'feature'
  | 'faq'
  | 'search';

/**
 * How cards in a `cardsGrid` (highlight) section lay out their icon:
 * - `default` - unchanged legacy behaviour (icon on top, or icon+title in a
 *   row for the title-matched sections in PolicyCardSections.tsx).
 * - `iconHeader` - icon + title in one row, content below.
 * - `iconMedia` - a bigger icon in its own left column; title, description
 *   and SubPoints all to its right.
 */
export type PolicyCardStyle =
  | 'default'
  | 'iconHeader'
  | 'iconMedia'
  /** processSteps: each step a column - number, icon circle, title, text (SAP Concur "How It Works"). */
  | 'stacked'
  /** imageCards: photo on top, badge, title, value, button (offers, hotels, "Business Travel & Mobility"). */
  | 'imageTop'
  /** imageCards: photo or icon on the left, text + arrow on the right (link cards). */
  | 'imageLeft'
  /** imageCards: compact tile - photo/icon, title and arrow (category tiles, "Key Policy Highlights"). */
  | 'imageTile'
  /** imageCards: big photo with the text over it (destination / meeting-room banners). */
  | 'imageBanner';

/** Share of the row a section takes; consecutive non-`full` sections sit side by side. */
export type PolicySectionWidth = 'full' | 'half' | 'oneThird' | 'twoThirds';

/** The container a section renders in. `plain` = no container (legacy). */
export type PolicySectionStyle = 'plain' | 'card' | 'tinted';

export type PolicyTheme = 'gold' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal';

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
  /** Cards per row for `cardsGrid` (highlight) sections; `undefined` = the responsive default. */
  columns: number | undefined;
  cardStyle: PolicyCardStyle;
  /** Tint each highlight card with its own `IconColor` (mockup's coloured cards). */
  tintCards: boolean;
  sectionStyle: PolicySectionStyle;
  /** Colour of a `tinted` container / its number badge; `undefined` = gold. */
  theme: PolicyTheme | undefined;
  width: PolicySectionWidth;
  /** Optional header action at the right of the section title, e.g. "View All Offers". */
  linkText: string | undefined;
  linkUrl: string | undefined;
  targetSlug: string | undefined;
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

export interface IPolicyHeroLink {
  text: string;
  /** Validated URL, or `undefined` when `targetSlug` is used instead. */
  url: string | undefined;
  /** In-app page slug (wins over `url`). */
  targetSlug: string | undefined;
  openInNewTab: boolean;
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
    /** Small caps line above the title, e.g. "TRAVEL POLICY" / "SAP Concur". */
    eyebrow: string | undefined;
    title: string;
    subtitle: string | undefined;
    description: string | undefined;
    imageUrl: string | undefined;
    tagline: string | undefined;
    /** `dark` (default) = text over a darkened photo; `light` = the mockups' light band, photo on the right. */
    style: 'dark' | 'light';
    /** Up to two hero buttons, e.g. "Access SAP Concur" / "New to SAP Concur? Start Here". */
    links: IPolicyHeroLink[];
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
