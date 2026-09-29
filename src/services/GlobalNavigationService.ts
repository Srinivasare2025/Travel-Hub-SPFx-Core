/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IGlobalNavItem, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import type { ITravelServicesService } from './TravelServicesService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { toStringOr } from '../common/utils/collection';

const LIST = 'TH_GlobalNavigation';
const TTL_SECONDS = 300;

interface IRawNavItem {
  Id: number;
  Title: string | null;
  Url: { Url: string } | null;
  Kind: string | null;
  DisplayOrder: number | null;
}

const SELECT = ['Id', 'Title', 'Url', 'Kind', 'DisplayOrder'];

export interface IGlobalNavigationService {
  /**
   * The global nav bar shown above the hero: a "Home" tab, one tab per
   * active `TH_TravelServices` row (Business Travel, Personal Travel,
   * Travel Policy, SAP Concur, Catering Services, Meetings & Events, …) —
   * every one of them opens an in-app page (`businessTravel`/`servicePage`/
   * `policyPage`), not the service's own `LinkUrl`, since Travel Care and
   * everything else needs a real destination, not a dead link — plus the
   * Help Desk / Travel Care hero quick links, plus any admin-added rows from
   * `TH_GlobalNavigation`.
   */
  getNavItems(config: ITravelHubConfiguration): Promise<IGlobalNavItem[]>;
}

export class GlobalNavigationService implements IGlobalNavigationService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly travelServices: ITravelServicesService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('GlobalNavigationService');
  }

  public async getNavItems(config: ITravelHubConfiguration): Promise<IGlobalNavItem[]> {
    const [builtIns, custom] = await Promise.all([this.getBuiltInItems(config), this.getCustomItems()]);
    return [...builtIns, ...custom];
  }

  /**
   * "Home" first (the only way back to the hub once you're on a sub-screen
   * that isn't the hero itself), then one tab per active Travel Service -
   * "Travel Policy" (wherever it sits in DisplayOrder - the sample data
   * positions it third, matching the mock) becomes the real in-app Travel
   * Policy tab, "Business Travel" becomes the real in-app Business Travel
   * page (`BusinessTravelPageScreen`); every other service becomes its own
   * in-app `ServicePageScreen` (title/description/icon reused from that
   * service row - "future we will decide content and layout" per the
   * business, so this is a real page, not a dead `#` link, while the actual
   * content is still pending) - then the Help Desk / Travel Care hero quick
   * links.
   */
  private async getBuiltInItems(config: ITravelHubConfiguration): Promise<IGlobalNavItem[]> {
    const items: IGlobalNavItem[] = [{ id: 0, title: 'Home', url: undefined, kind: 'home', openInNewTab: false }];
    let nextId = -1;

    if (config.sections.travelServices.isVisible) {
      try {
        const services = await this.travelServices.getServices(config);
        for (const service of services) {
          if (service.title.trim().toLowerCase() === 'travel policy') {
            items.push({ id: nextId--, title: service.title, url: 'travel-policy', kind: 'policy', openInNewTab: false });
            continue;
          }
          if (service.title.trim().toLowerCase() === 'business travel') {
            items.push({ id: nextId--, title: service.title, url: undefined, kind: 'businessTravel', openInNewTab: false });
            continue;
          }
          if (service.pageSlug !== undefined) {
            // A list-driven page (TH_TravelServices.PageSlug) - opens like a Travel Policy page.
            items.push({ id: nextId--, title: service.title, url: service.pageSlug, kind: 'policy', openInNewTab: false });
            continue;
          }
          items.push({ id: nextId--, title: service.title, url: String(service.id), kind: 'service', openInNewTab: false });
        }
      } catch {
        this.log.warn('Could not read TH_TravelServices for the global nav; showing only Home/Help Desk/Travel Care.');
      }
    }

    // Fallback: no active services (or the section is hidden) still gets a
    // working Travel Policy tab - it isn't gated by `sections.travelServices`.
    if (!items.some((i) => i.kind === 'policy')) {
      items.push({ id: nextId--, title: 'Travel Policy', url: 'travel-policy', kind: 'policy', openInNewTab: false });
    }

    for (const link of config.hero.quickLinks) {
      if (link.url === undefined || link.title.length === 0) {
        continue;
      }
      // The Help Desk nav tab is always labelled "Help Desk" regardless of
      // the configured hero card title, so a longer card title never breaks
      // the nav layout. Travel Care's `kind: 'image'` quick link (its QR
      // poster) opens the same in-app viewer the hero card uses, instead of
      // the browser navigating straight to the image file and showing its
      // raw path.
      const title = link.key === 'helpDesk' ? 'Help Desk' : link.title;
      items.push({
        id: nextId--,
        title,
        url: link.url,
        kind: link.kind === 'image' ? 'image' : 'app',
        openInNewTab: link.openInNewTab
      });
    }

    return items;
  }

  private async getCustomItems(): Promise<IGlobalNavItem[]> {
    return this.cache.getOrAdd(`globalNav:custom`, TTL_SECONDS, async () => {
      try {
        // Already ordered server-side by DisplayOrder - IGlobalNavItem has no
        // displayOrder field of its own, so this iteration order is final.
        const raw = await this.spo.getListItems<IRawNavItem>({
          list: LIST,
          select: SELECT,
          filter: 'IsActive eq 1',
          orderBy: { field: 'DisplayOrder', ascending: true },
          top: 30
        });
        const mapped: IGlobalNavItem[] = [];
        for (const item of raw) {
          const url = sanitizeUrl(item.Url?.Url);
          if (url === undefined) {
            this.log.warn(`Global nav item ${String(item.Id)} has no valid Url; skipped.`);
            continue;
          }
          const kind: IGlobalNavItem['kind'] = (item.Kind ?? 'App').toLowerCase() === 'external' ? 'external' : 'app';
          mapped.push({
            id: item.Id,
            title: toStringOr(item.Title, 'Untitled'),
            url,
            kind,
            openInNewTab: kind === 'external'
          });
        }
        return mapped;
      } catch {
        // TH_GlobalNavigation is optional - a site that hasn't provisioned it
        // yet still gets the built-in tabs, not a broken nav bar.
        this.log.warn(`Could not read ${LIST}; showing only the built-in navigation tabs.`);
        return [];
      }
    });
  }
}
