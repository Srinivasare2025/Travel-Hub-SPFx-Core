/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IGreenTravel } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { toOptionalString, toStringOr } from '../common/utils/collection';

const LIST = 'TH_GreenTravel';
const TTL_SECONDS = 600;

interface IRawGreenTravelItem {
  Id: number;
  Title: string | null;
  Description: string | null;
  Points: string | null;
  ImageUrl: { Url: string } | null;
  LinkUrl: { Url: string } | null;
  LinkText: string | null;
}

const SELECT = ['Id', 'Title', 'Description', 'Points', 'ImageUrl', 'LinkUrl', 'LinkText'];

export interface IGreenTravelService {
  /** The one active `TH_GreenTravel` record (ASSUMPTIONS A27), or `undefined` if none is active. */
  getContent(): Promise<IGreenTravel | undefined>;
}

export class GreenTravelService implements IGreenTravelService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('GreenTravelService');
  }

  public async getContent(): Promise<IGreenTravel | undefined> {
    return this.cache.getOrAdd('greenTravel', TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawGreenTravelItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        top: 1
      });
      const item = raw[0];
      if (item === undefined) {
        return undefined;
      }

      const linkUrl = sanitizeUrl(item.LinkUrl?.Url);
      if (item.LinkUrl?.Url !== undefined && linkUrl === undefined) {
        this.log.warn(`Green Travel item ${String(item.Id)} has an unsafe LinkUrl; the link will be hidden.`);
      }

      return {
        id: item.Id,
        title: toStringOr(item.Title, 'Green Travel'),
        description: toStringOr(item.Description, ''),
        points: toOptionalString(item.Points)
          ?.split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0) ?? [],
        imageUrl: sanitizeUrl(item.ImageUrl?.Url),
        linkUrl,
        linkText: toOptionalString(item.LinkText)
      };
    });
  }
}
