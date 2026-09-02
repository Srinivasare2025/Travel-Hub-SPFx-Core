/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IGlobalNavItem, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
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
   * The global nav bar shown above the hero: the three built-in tabs (Our
   * Services, and the same Help Desk / Travel Care links configured for the
   * hero quick links) plus any admin-added rows from `TH_GlobalNavigation`.
   */
  getNavItems(config: ITravelHubConfiguration): Promise<IGlobalNavItem[]>;
}

export class GlobalNavigationService implements IGlobalNavigationService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('GlobalNavigationService');
  }

  public async getNavItems(config: ITravelHubConfiguration): Promise<IGlobalNavItem[]> {
    const builtIns = this.getBuiltInItems(config);
    const custom = await this.getCustomItems();
    return [...builtIns, ...custom];
  }

  /**
   * "Our Services" (an in-page anchor - only if that section is configured
   * visible) plus the two hero quick links, mirroring their configured
   * title/URL so there's one source of truth (spec: "two links Help Desk and
   * Travel care and our services part of global navigation").
   */
  private getBuiltInItems(config: ITravelHubConfiguration): IGlobalNavItem[] {
    const items: IGlobalNavItem[] = [];

    if (config.sections.travelServices.isVisible) {
      items.push({
        id: -1,
        title: config.sections.travelServices.title ?? 'Our Services',
        url: '#th-services-heading',
        kind: 'app',
        openInNewTab: false
      });
    }

    let nextId = -2;
    for (const link of config.hero.quickLinks) {
      if (link.url === undefined || link.title.length === 0) {
        continue;
      }
      items.push({
        id: nextId--,
        title: link.title,
        url: link.url,
        kind: 'app',
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
        // yet still gets the 3 built-in tabs, not a broken nav bar.
        this.log.warn(`Could not read ${LIST}; showing only the built-in navigation tabs.`);
        return [];
      }
    });
  }
}
