/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IPolicyCard, IPolicyPageContent, PolicyCardKind } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl, toMailtoHref } from '../common/utils/urlValidation';
import { toNumber, toOptionalString, toStringOr } from '../common/utils/collection';

const PAGES_LIST = 'TH_PolicyPages';
const CARDS_LIST = 'TH_PolicyCards';
const TTL_SECONDS = 600;

interface IRawPage {
  Id: number;
  Title: string | null;
  Slug: string | null;
  ParentSlug: string | null;
  ParentTitle: string | null;
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
}

interface IRawCard {
  Id: number;
  Title: string | null;
  PageIdId: number | null;
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
}

const PAGE_SELECT = [
  'Id', 'Title', 'Slug', 'ParentSlug', 'ParentTitle', 'HeroIcon', 'HeroTitle', 'HeroSubtitle',
  'HeroDescription', 'HeroImageUrl', 'HeroTagline', 'InfoBannerText', 'NoteBannerText',
  'CtaTitle', 'CtaDescription', 'CtaLinkText', 'CtaLinkUrl', 'CtaPrimaryText', 'CtaPrimaryUrl',
  'ClosingBannerTitle', 'ClosingBannerDescription', 'ClosingBadges',
  'NeedHelpTitle', 'NeedHelpSupportLabel', 'NeedHelpDescription', 'NeedHelpEmail'
];

const CARD_SELECT = [
  'Id', 'Title', 'PageIdId', 'Kind', 'Number', 'Icon', 'IconColor', 'Description', 'SubPoints',
  'TargetSlug', 'LinkUrl', 'LinkText', 'DisplayOrder'
];

const KIND_MAP: Record<string, PolicyCardKind> = {
  category: 'category',
  info: 'info',
  highlight: 'highlight',
  rule: 'rule',
  helpstep: 'helpStep'
};

export interface IPolicyService {
  /** One Travel Policy page (landing page included) by its routing slug, or `undefined` if not found/inactive. */
  getPage(slug: string): Promise<IPolicyPageContent | undefined>;
}

/**
 * Travel Policy pages: one adaptive template (`PolicyPageScreen`) renders
 * whatever this returns - each section (category/info/highlight/rule/help
 * cards, the CTA row, the closing banner) only appears when its data is
 * present, so the same shape serves the landing page and every detail page.
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
      const raw = await this.spo.getListItems<IRawPage>({
        list: PAGES_LIST,
        select: PAGE_SELECT,
        filter: `IsActive eq 1 and Slug eq '${cleanSlug.replace(/'/g, "''")}'`,
        top: 1
      });
      const page = raw[0];
      if (page === undefined) {
        return undefined;
      }

      const cardsRaw = await this.spo.getListItems<IRawCard>({
        list: CARDS_LIST,
        select: CARD_SELECT,
        filter: `IsActive eq 1 and PageIdId eq ${String(page.Id)}`,
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 50
      });
      const cards = cardsRaw.map((item) => this.mapCard(item));

      return this.mapPage(page, cards);
    });
  }

  private mapPage(page: IRawPage, cards: IPolicyCard[]): IPolicyPageContent {
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
            email: toMailtoHref(page.NeedHelpEmail)?.slice('mailto:'.length)
          }
        : undefined;

    return {
      slug: toStringOr(page.Slug, ''),
      title: toStringOr(page.Title, 'Travel Policy'),
      parent: parentSlug !== undefined && parentTitle !== undefined ? { slug: parentSlug, title: parentTitle } : undefined,
      hero: {
        icon: toOptionalString(page.HeroIcon),
        title: toStringOr(page.HeroTitle, toStringOr(page.Title, 'Travel Policy')),
        subtitle: toOptionalString(page.HeroSubtitle),
        description: toOptionalString(page.HeroDescription),
        imageUrl: sanitizeUrl(page.HeroImageUrl?.Url),
        tagline: toOptionalString(page.HeroTagline)
      },
      infoBannerText: toOptionalString(page.InfoBannerText),
      noteBannerText: toOptionalString(page.NoteBannerText),
      cta,
      needHelp,
      closingBanner,
      cards
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
      title: toStringOr(item.Title, ''),
      description: toStringOr(item.Description, ''),
      icon: toStringOr(item.Icon, 'Info'),
      iconColor: toOptionalString(item.IconColor),
      subPoints: this.splitLines(item.SubPoints),
      targetSlug: toOptionalString(item.TargetSlug)?.trim().toLowerCase(),
      linkUrl,
      linkText: toOptionalString(item.LinkText),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
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
