/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelEvent, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toNumber, toStringOr, toOptionalString } from '../common/utils/collection';
import { parseSpDate } from '../common/utils/dateFormatting';

const LIST = 'TH_TravelEvents';
const TTL_SECONDS = 120;

interface IRawEventItem {
  Id: number;
  Title: string | null;
  Description: string | null;
  EventDate: string | null;
  StartTime: string | null;
  EndTime: string | null;
  Location: string | null;
  Category: string | null;
  ImageUrl: { Url: string } | null;
  RegistrationUrl: { Url: string } | null;
  DisplayOrder: number | null;
}

const SELECT = [
  'Id',
  'Title',
  'Description',
  'EventDate',
  'StartTime',
  'EndTime',
  'Location',
  'Category',
  'ImageUrl',
  'RegistrationUrl',
  'DisplayOrder'
];

export interface IEventService {
  /** Upcoming (today or later) events, soonest first, capped at `updates.eventsCount`. */
  getUpcomingEvents(config: ITravelHubConfiguration): Promise<ITravelEvent[]>;
}

export class EventService implements IEventService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('EventService');
  }

  public async getUpcomingEvents(config: ITravelHubConfiguration): Promise<ITravelEvent[]> {
    const count = config.updates.eventsCount;
    return this.cache.getOrAdd(`events:${String(count)}`, TTL_SECONDS, async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const raw = await this.spo.getListItems<IRawEventItem>({
        list: LIST,
        select: SELECT,
        filter: `IsActive eq 1 and EventDate ge datetime'${startOfToday.toISOString()}'`,
        orderBy: { field: 'EventDate', ascending: true },
        top: Math.max(count + 5, 15)
      });

      const mapped: ITravelEvent[] = [];
      for (const item of raw) {
        const mappedEvent = this.mapEvent(item);
        if (mappedEvent !== undefined) {
          mapped.push(mappedEvent);
        }
      }
      return orderBy(
        mapped,
        (e) => e.eventDate.getTime(),
        (e) => e.displayOrder
      ).slice(0, count);
    });
  }

  private mapEvent(item: IRawEventItem): ITravelEvent | undefined {
    const eventDate = parseSpDate(item.EventDate);
    if (eventDate === undefined) {
      this.log.warn(`Event ${String(item.Id)} has no valid EventDate; skipped.`);
      return undefined;
    }
    return {
      id: item.Id,
      title: toStringOr(item.Title, 'Untitled event'),
      description: toStringOr(item.Description, ''),
      eventDate,
      startTime: toOptionalString(item.StartTime),
      endTime: toOptionalString(item.EndTime),
      location: toOptionalString(item.Location),
      category: toOptionalString(item.Category),
      imageUrl: sanitizeUrl(item.ImageUrl?.Url),
      registrationUrl: sanitizeUrl(item.RegistrationUrl?.Url),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }
}
