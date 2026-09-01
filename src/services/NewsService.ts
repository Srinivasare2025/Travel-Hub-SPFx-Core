/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelNews, ITravelHubConfiguration, LinkType } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { toBool, toNumber, toStringOr, toOptionalString } from '../common/utils/collection';
import { parseSpDate } from '../common/utils/dateFormatting';

const LIST = 'TH_TravelNews';
const TTL_SECONDS = 120;

interface IRawNewsItem {
  Id: number;
  Title: string | null;
  Description: string | null;
  ImageUrl: { Url: string } | null;
  PublishDate: string | null;
  LinkType: string | null;
  TargetUrl: { Url: string } | null;
  Category: string | null;
  IsFeatured: boolean | null;
  OpenInNewTab: boolean | null;
  DisplayOrder: number | null;
}

const SELECT = [
  'Id',
  'Title',
  'Description',
  'ImageUrl',
  'PublishDate',
  'LinkType',
  'TargetUrl',
  'Category',
  'IsFeatured',
  'OpenInNewTab',
  'DisplayOrder'
];

function toLinkType(raw: string | null): LinkType {
  switch ((raw ?? '').toLowerCase()) {
    case 'external':
      return 'external';
    case 'onpremreference':
    case 'onprem':
      return 'onPremReference';
    default:
      return 'internal';
  }
}

export interface INewsService {
  /** Latest news, capped at `updates.newsCount`. First result is the featured item. */
  getNews(config: ITravelHubConfiguration): Promise<ITravelNews[]>;
}

export class NewsService implements INewsService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('NewsService');
  }

  public async getNews(config: ITravelHubConfiguration): Promise<ITravelNews[]> {
    const allowOnPrem = config.featureFlags.newsOnPremLinks !== false;
    const count = config.updates.newsCount;

    return this.cache.getOrAdd(`news:${String(count)}:${String(allowOnPrem)}`, TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawNewsItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'PublishDate', ascending: false },
        top: Math.max(count + 5, 15)
      });

      const mapped: ITravelNews[] = [];
      for (const item of raw) {
        const news = this.mapNews(item, allowOnPrem);
        if (news !== undefined) {
          mapped.push(news);
        }
      }

      // Order: featured first, then displayOrder, then newest.
      mapped.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) {
          return a.isFeatured ? -1 : 1;
        }
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return b.publishDate.getTime() - a.publishDate.getTime();
      });

      const trimmed = mapped.slice(0, count);
      // The lead card is always the first item regardless of the stored IsFeatured flags.
      return trimmed.map((item, index) => ({ ...item, isFeatured: index === 0 }));
    });
  }

  private mapNews(item: IRawNewsItem, allowOnPrem: boolean): ITravelNews | undefined {
    const linkType = toLinkType(item.LinkType);
    if (linkType === 'onPremReference' && !allowOnPrem) {
      return undefined;
    }

    const targetUrl = sanitizeUrl(item.TargetUrl?.Url);
    if (item.TargetUrl?.Url !== undefined && targetUrl === undefined) {
      this.log.warn(`News item ${String(item.Id)} has an unsafe TargetUrl; the link will be inert.`);
    }

    const publishDate = parseSpDate(item.PublishDate) ?? new Date(0);

    return {
      id: item.Id,
      title: toStringOr(item.Title, 'Untitled article'),
      description: toStringOr(item.Description, ''),
      imageUrl: sanitizeUrl(item.ImageUrl?.Url),
      publishDate,
      linkType,
      targetUrl,
      category: toOptionalString(item.Category),
      openInNewTab: toBool(item.OpenInNewTab, linkType !== 'internal'),
      displayOrder: toNumber(item.DisplayOrder, 0),
      isFeatured: toBool(item.IsFeatured, false)
    };
  }
}
