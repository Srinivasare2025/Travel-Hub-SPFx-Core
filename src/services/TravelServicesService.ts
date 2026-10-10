/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelService, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toBool, toNumber, toOptionalString, toStringOr } from '../common/utils/collection';
import { onColor, safeColor } from '../common/utils/color';

const LIST = 'TH_TravelServices';
const TTL_SECONDS = 300;

interface IRawServiceItem {
  Id: number;
  Title: string | null;
  Description: string | null;
  ImageUrl: { Url: string } | null;
  ImageFit: string | null;
  Icon: string | null;
  IconBackgroundColor: string | null;
  LinkUrl: { Url: string } | null;
  LinkType: string | null;
  LinkText: string | null;
  OpenInNewTab: boolean | null;
  DisplayOrder: number | null;
  PageSlug?: string | null;
}

// ImageFit is newer than the rest of this list's columns (added for the SAP
// Concur logo-cropping fix) - a site that hasn't re-run the provisioning
// script yet won't have that column, and SharePoint REST fails the *entire*
// $select when one field doesn't exist. BASE_SELECT is the fallback used if
// the full SELECT 400s, so a not-yet-provisioned site still gets a working
// carousel (every image just uses the 'cover' default) instead of the whole
// section - and the global nav tabs that read from this same call - going
// down.
const BASE_SELECT = [
  'Id',
  'Title',
  'Description',
  'ImageUrl',
  'Icon',
  'IconBackgroundColor',
  'LinkUrl',
  'LinkType',
  'LinkText',
  'OpenInNewTab',
  'DisplayOrder'
];
const SELECT = [...BASE_SELECT, 'ImageFit'];
// PageSlug (newest): opens a list-driven TH_PolicyPages page for this service.
const SELECT_WITH_PAGE = [...SELECT, 'PageSlug'];

const PAGES_LIST = 'TH_PolicyPages';

interface IRawPolicyPage {
  Title: string | null;
  Slug: string | null;
  ParentSlug?: string | null;
}

/** Handled by their own screens (title-matched in GlobalNavigationService / TravelServiceCard), never auto-linked. */
const SELF_ROUTED_SERVICES = ['travel policy', 'business travel'];
const STOP_WORDS = new Set(['and', 'the', 'of', 'for']);

/** "Meeting & Events" -> ['meeting', 'event']: lower-case words, `&` = and, plural `s` dropped. */
function titleWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/**
 * The TH_PolicyPages slug a service opens when its own `PageSlug` is empty:
 * a page whose Slug or Title matches the service title exactly (ignoring
 * case, `&`/"and" and plurals - "Meeting & Events" = "Meetings & Events"),
 * otherwise a page whose Title contains every word of a 2+ word service
 * title ("Travel Offers" -> "Personal Travel Offers"), preferring a
 * top-level page (no ParentSlug) and then the shortest title. An explicit
 * `PageSlug` always wins over this.
 */
export function resolveServicePageSlug(serviceTitle: string, pages: ReadonlyArray<IRawPolicyPage>): string | undefined {
  const words = titleWords(serviceTitle);
  if (words.length === 0 || SELF_ROUTED_SERVICES.indexOf(serviceTitle.trim().toLowerCase()) >= 0) {
    return undefined;
  }
  const key = words.join(' ');
  const candidates = pages
    .map((p) => ({ slug: (p.Slug ?? '').trim().toLowerCase(), words: titleWords(p.Title ?? ''), child: (p.ParentSlug ?? '').trim().length > 0 }))
    .filter((p) => p.slug.length > 0);

  const exact = candidates.find((p) => p.words.join(' ') === key || titleWords(p.slug).join(' ') === key);
  if (exact !== undefined) {
    return exact.slug;
  }
  if (words.length < 2) {
    return undefined;
  }
  const partial = candidates
    .filter((p) => words.every((w) => p.words.indexOf(w) >= 0))
    .sort((a, b) => Number(a.child) - Number(b.child) || a.words.length - b.words.length);
  return partial[0]?.slug;
}

export interface ITravelServicesService {
  getServices(config: ITravelHubConfiguration): Promise<ITravelService[]>;
}

export class TravelServicesService implements ITravelServicesService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('TravelServicesService');
  }

  public async getServices(config: ITravelHubConfiguration): Promise<ITravelService[]> {
    return this.cache.getOrAdd('travelServices', TTL_SECONDS, async () => {
      const nowIso = new Date().toISOString();
      const filter = `IsActive eq 1 and (StartDate eq null or StartDate le datetime'${nowIso}') and (EndDate eq null or EndDate ge datetime'${nowIso}')`;
      const orderByField = { field: 'DisplayOrder', ascending: true };

      let raw: IRawServiceItem[];
      try {
        raw = await this.spo
          .getListItems<IRawServiceItem>({ list: LIST, select: SELECT_WITH_PAGE, filter, orderBy: orderByField, top: 50 })
          .catch(() => this.spo.getListItems<IRawServiceItem>({ list: LIST, select: SELECT, filter, orderBy: orderByField, top: 50 }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.log.warn(`"${LIST}" query with ImageFit failed (column not provisioned yet?) - retrying without it. ${detail}`);
        raw = await this.spo.getListItems<IRawServiceItem>({ list: LIST, select: BASE_SELECT, filter, orderBy: orderByField, top: 50 });
      }

      const mapped = raw.map((item) => this.mapService(item, config.services.defaultLinkText));
      await this.linkPolicyPages(mapped);
      return orderBy(mapped, (s) => s.displayOrder);
    });
  }

  /**
   * Fills `pageSlug` for services whose PageSlug column is empty from the
   * matching TH_PolicyPages row (see `resolveServicePageSlug`), so a page
   * added to TH_PolicyPages opens from its global nav tab / service card
   * without also having to type its Slug into TH_TravelServices.
   */
  private async linkPolicyPages(services: ITravelService[]): Promise<void> {
    if (services.every((s) => s.pageSlug !== undefined)) {
      return;
    }
    let pages: IRawPolicyPage[];
    try {
      pages = await this.spo
        .getListItems<IRawPolicyPage>({ list: PAGES_LIST, select: ['Title', 'Slug', 'ParentSlug'], filter: 'IsActive eq 1', top: 500 })
        .catch(() => this.spo.getListItems<IRawPolicyPage>({ list: PAGES_LIST, select: ['Title', 'Slug'], filter: 'IsActive eq 1', top: 500 }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.log.warn(`Could not read "${PAGES_LIST}" to link services to pages; services without PageSlug open their service screen. ${detail}`);
      return;
    }
    for (const service of services) {
      if (service.pageSlug === undefined) {
        service.pageSlug = resolveServicePageSlug(service.title, pages);
      }
    }
  }

  private mapService(item: IRawServiceItem, defaultLinkText: string): ITravelService {
    const linkUrl = sanitizeUrl(item.LinkUrl?.Url);
    if (item.LinkUrl?.Url !== undefined && linkUrl === undefined) {
      this.log.warn(`Travel service ${String(item.Id)} has an unsafe LinkUrl; the action link will be hidden.`);
    }
    const linkType = (item.LinkType ?? 'internal').toLowerCase() === 'external' ? 'external' : 'internal';

    return {
      id: item.Id,
      title: toStringOr(item.Title, 'Untitled service'),
      description: toStringOr(item.Description, ''),
      imageUrl: sanitizeUrl(item.ImageUrl?.Url),
      imageFit: (item.ImageFit ?? '').toLowerCase() === 'contain' ? 'contain' : 'cover',
      icon: toStringOr(item.Icon, 'Page'),
      iconBackgroundColor: safeColor(item.IconBackgroundColor, 'var(--full-primary, #b89c67)'),
      // Default fill is RSG Gold, which needs navy (not white) on top.
      iconForegroundColor: onColor(item.IconBackgroundColor, '#04253c'),
      linkUrl,
      linkType,
      openInNewTab: toBool(item.OpenInNewTab, linkType === 'external'),
      linkText: toStringOr(item.LinkText, defaultLinkText),
      pageSlug: toOptionalString(item.PageSlug)?.trim().toLowerCase(),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }
}
