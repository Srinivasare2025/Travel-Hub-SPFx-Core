export type PolicyCardKind = 'category' | 'info' | 'highlight' | 'rule' | 'helpStep';

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
}

/** One page in the Travel Policy area (landing page included) — from TH_PolicyPages + TH_PolicyCards. */
export interface IPolicyPageContent {
  slug: string;
  title: string;
  parent: IPolicyPageParent | undefined;
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
  /** All active cards for this page, in DisplayOrder. Group by `kind` to render each section. */
  cards: IPolicyCard[];
}
