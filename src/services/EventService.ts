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
/** Hard cap for the "All Events" screen. */
const ALL_LIMIT = 500;

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
  EventDetails?: string | null;
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
  /** Every active event - upcoming soonest first, then past most-recent first (the "All Events" screen). */
  getAllEvents(): Promise<ITravelEvent[]>;
  /** One event with its rich details, or `undefined` when missing/inactive. */
  getEvent(id: number): Promise<ITravelEvent | undefined>;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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
      const raw = await this.spo.getListItems<IRawEventItem>({
        list: LIST,
        select: SELECT,
        filter: `IsActive eq 1 and EventDate ge datetime'${startOfToday().toISOString()}'`,
        orderBy: { field: 'EventDate', ascending: true },
        top: Math.max(count + 5, 15)
      });
      return orderBy(
        this.mapAll(raw),
        (e) => e.eventDate.getTime(),
        (e) => e.displayOrder
      ).slice(0, count);
    });
  }

  public async getAllEvents(): Promise<ITravelEvent[]> {
    return this.cache.getOrAdd('events:all', TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawEventItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'EventDate', ascending: false },
        top: ALL_LIMIT
      });
      const today = startOfToday().getTime();
      const events = this.mapAll(raw);
      const upcoming = orderBy(
        events.filter((e) => e.eventDate.getTime() >= today),
        (e) => e.eventDate.getTime(),
        (e) => e.displayOrder
      );
      const past = events.filter((e) => e.eventDate.getTime() < today).sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
      return [...upcoming, ...past];
    });
  }

  public async getEvent(id: number): Promise<ITravelEvent | undefined> {
    const filter = `Id eq ${String(Math.floor(id))} and IsActive eq 1`;
    let raw: IRawEventItem[];
    try {
      raw = await this.spo.getListItems<IRawEventItem>({ list: LIST, select: [...SELECT, 'EventDetails'], filter, top: 1 });
    } catch {
      // EventDetails not provisioned yet (re-run travelhub-provision.js) - show the event without it.
      this.log.warn(`${LIST}.EventDetails could not be read; showing the Description only.`);
      raw = await this.spo.getListItems<IRawEventItem>({ list: LIST, select: SELECT, filter, top: 1 });
    }
    const item = raw[0];
    return item === undefined ? undefined : this.mapEvent(item);
  }

  private mapAll(raw: IRawEventItem[]): ITravelEvent[] {
    const mapped: ITravelEvent[] = [];
    for (const item of raw) {
      const mappedEvent = this.mapEvent(item);
      if (mappedEvent !== undefined) {
        mapped.push(mappedEvent);
      }
    }
    return mapped;
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
      displayOrder: toNumber(item.DisplayOrder, 0),
      details: toOptionalString(item.EventDetails ?? null)
    };
  }
}
