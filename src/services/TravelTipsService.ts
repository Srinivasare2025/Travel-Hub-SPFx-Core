/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelTip, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toNumber, toStringOr, toOptionalString } from '../common/utils/collection';

const LIST = 'TH_TravelTips';
const TTL_SECONDS = 300;

interface IRawTipItem {
  Id: number;
  Title: string | null;
  Description: string | null;
  Icon: string | null;
  Category: string | null;
  LinkUrl: { Url: string } | null;
  DisplayOrder: number | null;
}

const SELECT = ['Id', 'Title', 'Description', 'Icon', 'Category', 'LinkUrl', 'DisplayOrder'];

export interface ITravelTipsService {
  getTips(config: ITravelHubConfiguration): Promise<ITravelTip[]>;
}

export class TravelTipsService implements ITravelTipsService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('TravelTipsService');
  }

  public async getTips(config: ITravelHubConfiguration): Promise<ITravelTip[]> {
    const count = config.updates.tipsCount;
    return this.cache.getOrAdd(`tips:${String(count)}`, TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawTipItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: Math.max(count + 5, 25)
      });

      const mapped = raw.map((item) => this.mapTip(item));
      return orderBy(mapped, (t) => t.displayOrder).slice(0, count);
    });
  }

  private mapTip(item: IRawTipItem): ITravelTip {
    const linkUrl = sanitizeUrl(item.LinkUrl?.Url);
    if (item.LinkUrl?.Url !== undefined && linkUrl === undefined) {
      this.log.warn(`Tip ${String(item.Id)} has an unsafe LinkUrl; the link will be hidden.`);
    }
    return {
      id: item.Id,
      title: toStringOr(item.Title, ''),
      description: toOptionalString(item.Description),
      icon: toStringOr(item.Icon, 'Lightbulb'),
      category: toOptionalString(item.Category),
      linkUrl,
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }
}
