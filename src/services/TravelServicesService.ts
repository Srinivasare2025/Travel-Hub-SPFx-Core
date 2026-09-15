/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelService, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toBool, toNumber, toStringOr } from '../common/utils/collection';
import { safeColor } from '../common/utils/color';

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
        raw = await this.spo.getListItems<IRawServiceItem>({ list: LIST, select: SELECT, filter, orderBy: orderByField, top: 50 });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.log.warn(`"${LIST}" query with ImageFit failed (column not provisioned yet?) - retrying without it. ${detail}`);
        raw = await this.spo.getListItems<IRawServiceItem>({ list: LIST, select: BASE_SELECT, filter, orderBy: orderByField, top: 50 });
      }

      const mapped = raw.map((item) => this.mapService(item, config.services.defaultLinkText));
      return orderBy(mapped, (s) => s.displayOrder);
    });
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
      iconBackgroundColor: safeColor(item.IconBackgroundColor, 'var(--full-primary, #b89c66)'),
      linkUrl,
      linkType,
      openInNewTab: toBool(item.OpenInNewTab, linkType === 'external'),
      linkText: toStringOr(item.LinkText, defaultLinkText),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }
}
