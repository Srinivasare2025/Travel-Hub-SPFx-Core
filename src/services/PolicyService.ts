/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import {
  IPolicyCard,
  IPolicyPageContent,
  IPolicySection,
  IPolicyTab,
  IPolicyTable,
  PolicyCardKind,
  PolicyCardStyle,
  PolicySectionLayout,
  PolicySectionStyle,
  PolicySectionWidth,
  PolicyTheme,
  IPolicyHeroLink
} from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl, toMailtoHref } from '../common/utils/urlValidation';
import { toNumber, toOptionalString, toStringOr } from '../common/utils/collection';

const PAGES_LIST = 'TH_PolicyPages';
const SECTIONS_LIST = 'TH_PolicySections';
const CARDS_LIST = 'TH_PolicyCards';
const TABLES_LIST = 'TH_PolicyTables';
const TABLE_ROWS_LIST = 'TH_PolicyTableRows';
const TABS_LIST = 'TH_PolicyTabs';
const TTL_SECONDS = 600;

interface IRawPage {
  Id: number;
  Title: string | null;
  Slug: string | null;
  ParentSlug: string | null;
  ParentTitle: string | null;
  ParentSectionLabel: string | null;
  HeroIcon: string | null;
  HeroTitle: string | null;
  HeroSubtitle: string | null;
  HeroDescription: string | null;
  HeroImageUrl: { Url: string } | null;
  HeroTagline: string | null;
  InfoBannerText: string | null;
  NoteBannerText: string | null;
  CtaTitle: string | null;
  CtaDescription: string | null;
  CtaLinkText: string | null;
  CtaLinkUrl: { Url: string } | null;
  CtaPrimaryText: string | null;
  CtaPrimaryUrl: { Url: string } | null;
  ClosingBannerTitle: string | null;
  ClosingBannerDescription: string | null;
  ClosingBadges: string | null;
  NeedHelpTitle: string | null;
  NeedHelpSupportLabel: string | null;
  NeedHelpDescription: string | null;
  NeedHelpEmail: string | null;
  SuggestedQuestions: string | null;
  AssistantLinkText: string | null;
  AssistantLinkUrl: { Url: string } | null;
  // Optional (newer) columns.
  HeroEyebrow?: string | null;
  HeroStyle?: string | null;
  HeroLinkText?: string | null;
  HeroLinkUrl?: { Url: string } | null;
  HeroLinkTargetSlug?: string | null;
  HeroLink2Text?: string | null;
  HeroLink2Url?: { Url: string } | null;
  HeroLink2TargetSlug?: string | null;
}

interface IRawSection {
  Id: number;
  Title: string | null;
  PageIdId: number | null;
  Subtitle: string | null;
  Layout: string | null;
  CardVariant: string | null;
  Body: string | null;
  Icon: string | null;
  ImageUrl: { Url: string } | null;
  DisplayOrder: number | null;
  // Optional columns (added later) - absent on sites where provisioning hasn't been re-run.
  HideTitle?: boolean | null;
  TabIdId?: number | null;
  Columns?: number | null;
  CardStyle?: string | null;
  TintCards?: boolean | null;
  SectionStyle?: string | null;
  Theme?: string | null;
  Width?: string | null;
  LinkText?: string | null;
  LinkUrl?: { Url: string } | null;
  TargetSlug?: string | null;
}

interface IRawTab {
  Id: number;
  Title: string | null;
  SectionIdId: number | null;
  Subtitle: string | null;
  Description: string | null;
  Icon: string | null;
  DisplayOrder: number | null;
}

interface IRawCard {
  Id: number;
  Title: string | null;
  PageIdId: number | null;
  SectionIdId: number | null;
  TabIdId: number | null;
  Kind: string | null;
  Number: number | null;
  Icon: string | null;
  IconColor: string | null;
  Description: string | null;
  SubPoints: string | null;
  TargetSlug: string | null;
  LinkUrl: { Url: string } | null;
  LinkText: string | null;
  DisplayOrder: number | null;
  // Optional (newer) columns.
  ImageUrl?: { Url: string } | null;
  Subtitle?: string | null;
  Badge?: string | null;
  Value?: string | null;
  ValueLabel?: string | null;
  ValueNote?: string | null;
  OpenInNewTab?: boolean | null;
}

interface IRawTable {
  Id: number;
  Title: string | null;
  SectionIdId: number | null;
  TabIdId: number | null;
  ColumnHeaders: string | null;
  DisplayOrder: number | null;
}

interface IRawTableRow {
  Id: number;
  TableIdId: number | null;
  CellValues: string | null;
  DisplayOrder: number | null;
}

const PAGE_SELECT = [
  'Id', 'Title', 'Slug', 'ParentSlug', 'ParentTitle', 'ParentSectionLabel', 'HeroIcon', 'HeroTitle', 'HeroSubtitle',
  'HeroDescription', 'HeroImageUrl', 'HeroTagline', 'InfoBannerText', 'NoteBannerText',
  'CtaTitle', 'CtaDescription', 'CtaLinkText', 'CtaLinkUrl', 'CtaPrimaryText', 'CtaPrimaryUrl',
  'ClosingBannerTitle', 'ClosingBannerDescription', 'ClosingBadges',
  'NeedHelpTitle', 'NeedHelpSupportLabel', 'NeedHelpDescription', 'NeedHelpEmail', 'SuggestedQuestions',
  'AssistantLinkText', 'AssistantLinkUrl'
];

const SECTION_SELECT = ['Id', 'Title', 'PageIdId', 'Subtitle', 'Layout', 'CardVariant', 'Body', 'Icon', 'ImageUrl', 'DisplayOrder'];
/**
 * `HideTitle` lets a section carry an internal Title (so it's identifiable in
 * TH_PolicyCards' SectionId lookup) without that Title showing on the page.
 * Selected separately with a fallback, so a site where the column hasn't been
 * provisioned yet keeps loading exactly as before.
 */
const SECTION_SELECT_WITH_HIDE_TITLE = [...SECTION_SELECT, 'HideTitle'];
/** Every optional section column (see IRawSection) - tried first, falling back step by step. */
const SECTION_SELECT_EXTENDED = [...SECTION_SELECT_WITH_HIDE_TITLE, 'TabIdId', 'Columns', 'CardStyle', 'TintCards', 'SectionStyle', 'Theme'];
const SECTION_SELECT_V3 = [...SECTION_SELECT_EXTENDED, 'Width', 'LinkText', 'LinkUrl', 'TargetSlug'];
const PAGE_SELECT_EXTENDED = [
  ...PAGE_SELECT,
  'HeroEyebrow', 'HeroStyle', 'HeroLinkText', 'HeroLinkUrl', 'HeroLinkTargetSlug', 'HeroLink2Text', 'HeroLink2Url', 'HeroLink2TargetSlug'
];
const WIDTHS: Record<string, PolicySectionWidth> = { full: 'full', half: 'half', onethird: 'oneThird', twothirds: 'twoThirds' };

/** A card Title written in square brackets is an internal name, not shown on the page. */
const INTERNAL_TITLE_RE = /^\[.*\]$/;

const THEMES: readonly PolicyTheme[] = ['gold', 'blue', 'green', 'amber', 'red', 'purple', 'teal'];
const TAB_SELECT = ['Id', 'Title', 'SectionIdId', 'Subtitle', 'Description', 'Icon', 'DisplayOrder'];
const CARD_SELECT = [
  'Id', 'Title', 'PageIdId', 'SectionIdId', 'TabIdId', 'Kind', 'Number', 'Icon', 'IconColor', 'Description', 'SubPoints',
  'TargetSlug', 'LinkUrl', 'LinkText', 'DisplayOrder'
];
const CARD_SELECT_EXTENDED = [...CARD_SELECT, 'ImageUrl', 'Subtitle', 'Badge', 'Value', 'ValueLabel', 'ValueNote', 'OpenInNewTab'];
const TABLE_SELECT = ['Id', 'Title', 'SectionIdId', 'TabIdId', 'ColumnHeaders', 'DisplayOrder'];
const TABLE_ROW_SELECT = ['Id', 'TableIdId', 'CellValues', 'DisplayOrder'];

const KIND_MAP: Record<string, PolicyCardKind> = {
  category: 'category',
  info: 'info',
  highlight: 'highlight',
  rule: 'rule',
  helpstep: 'helpStep',
  linkitem: 'linkItem'
};

const LAYOUT_MAP: Record<string, PolicySectionLayout> = {
  paragraph: 'paragraph',
  cardsgrid: 'cardsGrid',
  table: 'table',
  tabs: 'tabs',
  numberedsteps: 'numberedSteps',
  processsteps: 'processSteps',
  callout: 'callout',
  imageblock: 'imageBlock',
  linkslist: 'linksList',
  split: 'split',
  checklist: 'checklist',
  banner: 'banner',
  imagecards: 'imageCards',
  feature: 'feature',
  faq: 'faq',
  search: 'search'
};

/** `field eq id1 or field eq id2 …`; `undefined` when `ids` is empty (skip the request). */
function inFilter(field: string, ids: number[]): string | undefined {
  if (ids.length === 0) {
    return undefined;
  }
  return ids.map((id) => `${field} eq ${String(id)}`).join(' or ');
}

export interface IPolicyService {
  /** One Travel Policy page (landing page included) by its routing slug, or `undefined` if not found/inactive. */
  getPage(slug: string): Promise<IPolicyPageContent | undefined>;
}

/**
 * Travel Policy pages: one adaptive template (`PolicyPageScreen`) renders
 * whatever this returns. A page is an ordered list of `TH_PolicySections`
 * rows (`IPolicySection`); each section's `layout` picks how it renders, and
 * carries its own cards (`TH_PolicyCards`), tables (`TH_PolicyTables` +
 * `TH_PolicyTableRows`) and/or tabs (`TH_PolicyTabs`, each with its own
 * cards/tables). This generic shape is what lets the same 2 pages (Travel
 * Policy home, Annual Flight Ticket Benefits) and the 6 "Explore Policy
 * Information" sub-pages - each laid out differently - share one service and
 * one screen component instead of one-off code per page.
 */
export class PolicyService implements IPolicyService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('PolicyService');
  }

  public async getPage(slug: string): Promise<IPolicyPageContent | undefined> {
    const cleanSlug = slug.trim().toLowerCase();
    if (cleanSlug.length === 0) {
      return undefined;
    }
    return this.cache.getOrAdd(`policy:page:${cleanSlug}`, TTL_SECONDS, async () => {
      const pageQuery = { list: PAGES_LIST, filter: `IsActive eq 1 and Slug eq '${cleanSlug.replace(/'/g, "''")}'`, top: 1 };
      const raw = await this.spo
        .getListItems<IRawPage>({ ...pageQuery, select: PAGE_SELECT_EXTENDED })
        .catch(() => this.spo.getListItems<IRawPage>({ ...pageQuery, select: PAGE_SELECT }));
      const page = raw[0];
      if (page === undefined) {
        return undefined;
      }

      const sectionQuery = {
        list: SECTIONS_LIST,
        filter: `IsActive eq 1 and PageIdId eq ${String(page.Id)}`,
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 50
      };
      // Newest columns first; a site where provisioning hasn't been re-run
      // yet falls back to the older column sets and renders as before.
      let sectionSelect = SECTION_SELECT_V3;
      const allSectionsRaw = await this.spo
        .getListItems<IRawSection>({ ...sectionQuery, select: SECTION_SELECT_V3 })
        .catch(() => {
          sectionSelect = SECTION_SELECT_EXTENDED;
          return this.spo.getListItems<IRawSection>({ ...sectionQuery, select: SECTION_SELECT_EXTENDED });
        })
        .catch(() => {
          sectionSelect = SECTION_SELECT_WITH_HIDE_TITLE;
          return this.spo.getListItems<IRawSection>({ ...sectionQuery, select: SECTION_SELECT_WITH_HIDE_TITLE });
        })
        .catch(() => {
          sectionSelect = SECTION_SELECT;
          return this.spo.getListItems<IRawSection>({ ...sectionQuery, select: SECTION_SELECT });
        });
      // Top-level sections are the page's own blocks; a section with TabId
      // set lives inside that tab instead (see IPolicyTab.sections).
      const isNested = (raw: IRawSection): boolean => raw.TabIdId !== null && raw.TabIdId !== undefined;
      const topSectionIds = allSectionsRaw.filter((raw) => !isNested(raw)).map((raw) => raw.Id);

      const tabsRaw = topSectionIds.length > 0
        ? await this.spo.getListItems<IRawTab>({
            list: TABS_LIST,
            select: TAB_SELECT,
            filter: `IsActive eq 1 and (${inFilter('SectionIdId', topSectionIds) as string})`,
            orderBy: { field: 'DisplayOrder', ascending: true },
            top: 50
          })
        : [];
      const tabIds = tabsRaw.map((t) => t.Id);

      // Tab sections whose PageId was left blank are still found via TabId.
      const tabSectionFilter = sectionSelect.indexOf('TabIdId') >= 0 ? inFilter('TabIdId', tabIds) : undefined;
      const extraTabSections = tabSectionFilter !== undefined
        ? await this.spo
            .getListItems<IRawSection>({ ...sectionQuery, filter: `IsActive eq 1 and (${tabSectionFilter})`, select: sectionSelect })
            .catch((): IRawSection[] => [])
        : [];
      const knownIds = new Set(allSectionsRaw.map((raw) => raw.Id));
      const sectionsRaw = [...allSectionsRaw, ...extraTabSections.filter((raw) => !knownIds.has(raw.Id))];
      const sectionIds = sectionsRaw.map((raw) => raw.Id);

      // Both cards and tables can belong directly to a section or to one of
      // its tabs, so both are fetched with the same "section or tab" filter.
      const parentFilter = this.combineParentFilter(sectionIds, tabIds, 'SectionIdId', 'TabIdId');
      const cardQuery = {
        list: CARDS_LIST,
        filter: `IsActive eq 1 and (${parentFilter ?? 'Id eq 0'})`,
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 300
      };
      let cardSelect = CARD_SELECT_EXTENDED;
      const cardsRaw = parentFilter !== undefined
        ? await this.spo.getListItems<IRawCard>({ ...cardQuery, select: CARD_SELECT_EXTENDED }).catch(() => {
            cardSelect = CARD_SELECT;
            return this.spo.getListItems<IRawCard>({ ...cardQuery, select: CARD_SELECT });
          })
        : [];

      const tablesRaw = parentFilter !== undefined
        ? await this.spo.getListItems<IRawTable>({
            list: TABLES_LIST,
            select: TABLE_SELECT,
            filter: parentFilter,
            orderBy: { field: 'DisplayOrder', ascending: true },
            top: 100
          })
        : [];
      const tableIds = tablesRaw.map((t) => t.Id);

      const tableRowsFilter = inFilter('TableIdId', tableIds);
      const tableRowsRaw = tableRowsFilter !== undefined
        ? await this.spo.getListItems<IRawTableRow>({
            list: TABLE_ROWS_LIST,
            select: TABLE_ROW_SELECT,
            filter: tableRowsFilter,
            orderBy: { field: 'DisplayOrder', ascending: true },
            top: 500
          })
        : [];

      const tables = this.assembleTables(tablesRaw, tableRowsRaw);

      // Group cards/tables onto their parent - a tab when TabIdId is set,
      // otherwise the section directly - using each raw row's own Id.
      const cardsBySection = new Map<number, IPolicyCard[]>();
      const cardsByTab = new Map<number, IPolicyCard[]>();
      cardsRaw.forEach((raw) => {
        const card = this.mapCard(raw);
        if (raw.TabIdId !== null && raw.TabIdId !== undefined) {
          this.pushTo(cardsByTab, raw.TabIdId, card);
        } else if (raw.SectionIdId !== null && raw.SectionIdId !== undefined) {
          this.pushTo(cardsBySection, raw.SectionIdId, card);
        }
      });

      const tablesBySection = new Map<number, IPolicyTable[]>();
      const tablesByTab = new Map<number, IPolicyTable[]>();
      tablesRaw.forEach((raw, i) => {
        const table = tables[i];
        if (raw.TabIdId !== null && raw.TabIdId !== undefined) {
          this.pushTo(tablesByTab, raw.TabIdId, table);
        } else if (raw.SectionIdId !== null && raw.SectionIdId !== undefined) {
          this.pushTo(tablesBySection, raw.SectionIdId, table);
        }
      });

      // Sections nested in a tab (one level only - they carry no tabs of their own).
      const sectionsByTab = new Map<number, IPolicySection[]>();
      sectionsRaw.filter(isNested).forEach((raw) => {
        this.pushTo(sectionsByTab, raw.TabIdId as number, this.mapSection(raw, cardsBySection, tablesBySection, new Map()));
      });
      sectionsByTab.forEach((list) => list.sort((a, b) => a.displayOrder - b.displayOrder));

      const tabsBySection = new Map<number, IPolicyTab[]>();
      tabsRaw.forEach((raw) => {
        const tab: IPolicyTab = {
          id: raw.Id,
          label: toStringOr(raw.Title, ''),
          subtitle: toOptionalString(raw.Subtitle),
          description: toOptionalString(raw.Description),
          icon: toOptionalString(raw.Icon),
          cards: cardsByTab.get(raw.Id) ?? [],
          tables: tablesByTab.get(raw.Id) ?? [],
          sections: sectionsByTab.get(raw.Id) ?? [],
          displayOrder: toNumber(raw.DisplayOrder, 0)
        };
        if (raw.SectionIdId !== null && raw.SectionIdId !== undefined) {
          this.pushTo(tabsBySection, raw.SectionIdId, tab);
        }
      });

      const sections = sectionsRaw
        .filter((raw) => !isNested(raw))
        .map((raw) => this.mapSection(raw, cardsBySection, tablesBySection, tabsBySection));

      // The "Ask HR" style steps under Need Help are a fixed page-level
      // feature (not a reorderable content block) - attached directly via
      // PageId, same as the CTA/closing banner fields below.
      const needHelpStepsRaw = await this.spo.getListItems<IRawCard>({
        list: CARDS_LIST,
        select: cardSelect,
        filter: `IsActive eq 1 and PageIdId eq ${String(page.Id)} and Kind eq 'HelpStep'`,
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 20
      });
      const needHelpSteps = needHelpStepsRaw.map((item) => this.mapCard(item));

      return this.mapPage(page, sections, needHelpSteps);
    });
  }

  /** `(SectionIdId eq s1 or … ) or (TabIdId eq t1 or …)`; `undefined` when both id lists are empty. */
  private combineParentFilter(sectionIds: number[], tabIds: number[], sectionField: string, tabField: string): string | undefined {
    const sectionPart = inFilter(sectionField, sectionIds);
    const tabPart = inFilter(tabField, tabIds);
    if (sectionPart !== undefined && tabPart !== undefined) {
      return `(${sectionPart}) or (${tabPart})`;
    }
    return sectionPart ?? tabPart;
  }

  private pushTo<T>(map: Map<number, T[]>, key: number, value: T): void {
    const list = map.get(key);
    if (list !== undefined) {
      list.push(value);
    } else {
      map.set(key, [value]);
    }
  }

  private assembleTables(tablesRaw: IRawTable[], rowsRaw: IRawTableRow[]): IPolicyTable[] {
    return tablesRaw.map((t) => ({
      id: t.Id,
      title: toOptionalString(t.Title),
      columnHeaders: this.splitLines(t.ColumnHeaders),
      rows: rowsRaw
        .filter((r) => r.TableIdId === t.Id)
        .map((r) => ({ id: r.Id, cells: this.splitLines(r.CellValues), displayOrder: toNumber(r.DisplayOrder, 0) })),
      displayOrder: toNumber(t.DisplayOrder, 0)
    }));
  }

  private mapSection(
    s: IRawSection,
    cardsBySection: Map<number, IPolicyCard[]>,
    tablesBySection: Map<number, IPolicyTable[]>,
    tabsBySection: Map<number, IPolicyTab[]>
  ): IPolicySection {
    const layout = LAYOUT_MAP[(s.Layout ?? 'paragraph').toLowerCase()] ?? 'paragraph';
    return {
      id: s.Id,
      title: s.HideTitle === true ? undefined : toOptionalString(s.Title),
      subtitle: toOptionalString(s.Subtitle),
      layout,
      cardVariant: this.mapCardVariant(s.CardVariant),
      body: toOptionalString(s.Body),
      icon: toOptionalString(s.Icon),
      imageUrl: sanitizeUrl(s.ImageUrl?.Url),
      cards: cardsBySection.get(s.Id) ?? [],
      tables: tablesBySection.get(s.Id) ?? [],
      tabs: tabsBySection.get(s.Id) ?? [],
      columns: this.mapColumns(s.Columns),
      cardStyle: this.mapCardStyle(s.CardStyle),
      tintCards: s.TintCards === true,
      sectionStyle: this.mapSectionStyle(s.SectionStyle),
      theme: this.mapTheme(s.Theme),
      width: WIDTHS[(s.Width ?? '').replace(/\s+/g, '').toLowerCase()] ?? 'full',
      linkText: toOptionalString(s.LinkText),
      linkUrl: sanitizeUrl(s.LinkUrl?.Url),
      targetSlug: toOptionalString(s.TargetSlug)?.trim().toLowerCase(),
      displayOrder: toNumber(s.DisplayOrder, 0)
    };
  }

  private mapColumns(value: number | null | undefined): number | undefined {
    return typeof value === 'number' && value >= 1 && value <= 6 ? Math.floor(value) : undefined;
  }

  private mapCardStyle(value: string | null | undefined): PolicyCardStyle {
    const v = (value ?? '').replace(/\s+/g, '').toLowerCase();
    if (v === 'iconheader') {
      return 'iconHeader';
    }
    if (v === 'iconmedia') {
      return 'iconMedia';
    }
    const extra: Record<string, PolicyCardStyle> = {
      stacked: 'stacked',
      imagetop: 'imageTop',
      imageleft: 'imageLeft',
      imagetile: 'imageTile',
      imagebanner: 'imageBanner'
    };
    return extra[v] ?? 'default';
  }

  private mapSectionStyle(value: string | null | undefined): PolicySectionStyle {
    const v = (value ?? '').toLowerCase();
    return v === 'card' || v === 'tinted' ? v : 'plain';
  }

  private mapTheme(value: string | null | undefined): PolicyTheme | undefined {
    const v = (value ?? '').toLowerCase() as PolicyTheme;
    return THEMES.indexOf(v) >= 0 ? v : undefined;
  }

  private mapCardVariant(value: string | null): 'category' | 'info' | 'highlight' | undefined {
    const v = (value ?? '').toLowerCase();
    if (v === 'category' || v === 'info' || v === 'highlight') {
      return v;
    }
    return undefined;
  }

  private mapPage(page: IRawPage, sections: IPolicySection[], needHelpSteps: IPolicyCard[]): IPolicyPageContent {
    const parentSlug = toOptionalString(page.ParentSlug);
    const parentTitle = toOptionalString(page.ParentTitle);

    const ctaTitle = toOptionalString(page.CtaTitle);
    const cta =
      ctaTitle !== undefined
        ? {
            title: ctaTitle,
            description: toStringOr(page.CtaDescription, ''),
            linkText: toOptionalString(page.CtaLinkText),
            linkUrl: sanitizeUrl(page.CtaLinkUrl?.Url),
            primaryText: toOptionalString(page.CtaPrimaryText),
            primaryUrl: sanitizeUrl(page.CtaPrimaryUrl?.Url)
          }
        : undefined;

    const closingTitle = toOptionalString(page.ClosingBannerTitle);
    const closingBanner =
      closingTitle !== undefined
        ? {
            title: closingTitle,
            description: toStringOr(page.ClosingBannerDescription, ''),
            badges: this.splitLines(page.ClosingBadges)
          }
        : undefined;

    const needHelpTitle = toOptionalString(page.NeedHelpTitle);
    const needHelp =
      needHelpTitle !== undefined
        ? {
            title: needHelpTitle,
            supportLabel: toOptionalString(page.NeedHelpSupportLabel),
            description: toStringOr(page.NeedHelpDescription, ''),
            email: toMailtoHref(page.NeedHelpEmail)?.slice('mailto:'.length),
            steps: needHelpSteps
          }
        : undefined;

    return {
      slug: toStringOr(page.Slug, ''),
      title: toStringOr(page.Title, 'Travel Policy'),
      parent: parentSlug !== undefined && parentTitle !== undefined ? { slug: parentSlug, title: parentTitle } : undefined,
      parentSectionLabel: toOptionalString(page.ParentSectionLabel),
      hero: {
        icon: toOptionalString(page.HeroIcon),
        eyebrow: toOptionalString(page.HeroEyebrow),
        title: toStringOr(page.HeroTitle, toStringOr(page.Title, 'Travel Policy')),
        subtitle: toOptionalString(page.HeroSubtitle),
        description: toOptionalString(page.HeroDescription),
        imageUrl: sanitizeUrl(page.HeroImageUrl?.Url),
        tagline: toOptionalString(page.HeroTagline),
        style: (page.HeroStyle ?? '').toLowerCase() === 'light' ? 'light' : 'dark',
        links: [
          this.mapHeroLink(page.HeroLinkText, page.HeroLinkUrl, page.HeroLinkTargetSlug),
          this.mapHeroLink(page.HeroLink2Text, page.HeroLink2Url, page.HeroLink2TargetSlug)
        ].filter((l): l is IPolicyHeroLink => l !== undefined)
      },
      infoBannerText: toOptionalString(page.InfoBannerText),
      noteBannerText: toOptionalString(page.NoteBannerText),
      cta,
      needHelp,
      closingBanner,
      suggestedQuestions: this.splitLines(page.SuggestedQuestions),
      assistantLinkUrl: sanitizeUrl(page.AssistantLinkUrl?.Url),
      assistantLinkText: toOptionalString(page.AssistantLinkText),
      sections
    };
  }

  private mapCard(item: IRawCard): IPolicyCard {
    const kind = KIND_MAP[(item.Kind ?? 'info').toLowerCase()] ?? 'info';
    const linkUrl = sanitizeUrl(item.LinkUrl?.Url);
    if (item.LinkUrl?.Url !== undefined && linkUrl === undefined) {
      this.log.warn(`Policy card ${String(item.Id)} has an unsafe LinkUrl; the link will be hidden.`);
    }
    return {
      id: item.Id,
      kind,
      number: item.Number ?? undefined,
      // "[Principle 1]" = an internal name only (TH_PolicyCards.Title is
      // required in the list form) - rendered as an untitled card/part.
      title: INTERNAL_TITLE_RE.test(toStringOr(item.Title, '').trim()) ? '' : toStringOr(item.Title, ''),
      description: toStringOr(item.Description, ''),
      icon: toStringOr(item.Icon, 'Info'),
      iconExplicit: toOptionalString(item.Icon) !== undefined,
      iconColor: toOptionalString(item.IconColor),
      subPoints: this.splitLines(item.SubPoints),
      targetSlug: toOptionalString(item.TargetSlug)?.trim().toLowerCase(),
      linkUrl,
      linkText: toOptionalString(item.LinkText),
      openInNewTab: item.OpenInNewTab === true,
      imageUrl: sanitizeUrl(item.ImageUrl?.Url),
      subtitle: toOptionalString(item.Subtitle),
      badge: toOptionalString(item.Badge),
      value: toOptionalString(item.Value),
      valueLabel: toOptionalString(item.ValueLabel),
      valueNote: toOptionalString(item.ValueNote),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }

  private mapHeroLink(
    text: string | null | undefined,
    url: { Url: string } | null | undefined,
    targetSlug: string | null | undefined
  ): IPolicyHeroLink | undefined {
    const label = toOptionalString(text);
    const slug = toOptionalString(targetSlug)?.trim().toLowerCase();
    const href = sanitizeUrl(url?.Url);
    if (label === undefined || (slug === undefined && href === undefined)) {
      return undefined;
    }
    return { text: label, url: href, targetSlug: slug, openInNewTab: slug === undefined && href !== undefined && /^https?:/i.test(href) };
  }

  private splitLines(value: string | null): string[] {
    return (
      toOptionalString(value)
        ?.split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0) ?? []
    );
  }
}
