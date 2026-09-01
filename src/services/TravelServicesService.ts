/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelService, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toBool, toNumber, toStringOr } from '../common/utils/collection';

const LIST = 'TH_TravelServices';
const TTL_SECONDS = 300;

/** Safe CSS colour for the icon chip background: #rgb/#rrggbb or a --full-* token name. */
function safeColor(raw: string | null | undefined, fallback: string): string {
  const v = (raw ?? '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
    return v;
  }
  if (/^--full-[a-z-]+$/.test(v)) {
    return `var(${v})`;
  }
  return fallback;
}

interface IRawServiceItem {
  Id: number;
  Title: string | null;
  Description: string | null;
  ImageUrl: { Url: string } | null;
  Icon: string | null;
  IconBackgroundColor: string | null;
  LinkUrl: { Url: string } | null;
  LinkType: string | null;
  LinkText: string | null;
  OpenInNewTab: boolean | null;
  DisplayOrder: number | null;
}

const SELECT = [
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
      const raw = await this.spo.getListItems<IRawServiceItem>({
        list: LIST,
        select: SELECT,
        filter: `IsActive eq 1 and (StartDate eq null or StartDate le datetime'${nowIso}') and (EndDate eq null or EndDate ge datetime'${nowIso}')`,
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 50
      });

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
