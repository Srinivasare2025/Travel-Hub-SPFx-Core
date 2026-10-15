/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelSpend, ITravelSpendAccess, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { toPowerBiEmbedUrl } from '../common/utils/powerBi';
import { toNumber, toStringOr } from '../common/utils/collection';

const LIST = 'TH_DepartmentTravelSpend';

interface IRawSpendItem {
  Id: number;
  Title: string | null;
  Period: string | null;
  Currency: string | null;
  TotalSpend: number | null;
  AirSpend: number | null;
  HotelSpend: number | null;
  GroundTransportSpend: number | null;
  BookingSpend: number | null;
  DashboardUrl: { Url: string } | null;
}

const SELECT = [
  'Id',
  'Title',
  'Period',
  'Currency',
  'TotalSpend',
  'AirSpend',
  'HotelSpend',
  'GroundTransportSpend',
  'BookingSpend',
  'DashboardUrl'
];

export interface ITravelSpendService {
  /**
   * A dashboard URL in its frame-able form. Power BI app links can't be shown
   * in an iframe ("refused to connect"); this returns the secure-embed URL
   * that signs the viewer in silently (common/utils/powerBi.ts).
   */
  toEmbedUrl(url: string | undefined): string | undefined;
  /** Whether the current user may see spend figures at all. Call before `getSpend()`. */
  getAccess(config: ITravelHubConfiguration): Promise<ITravelSpendAccess>;
  /** Only call when `getAccess()` returned `hasAccess: true`. */
  getSpend(config: ITravelHubConfiguration): Promise<ITravelSpend | undefined>;
}

/**
 * SECURITY.md §3 / ASSUMPTIONS A23-A26: TravelHub never computes spend, and
 * the SPFx UI is never the security boundary — the restricted
 * `TH_DepartmentTravelSpend` list (or, once built, Power BI RLS / Concur /
 * warehouse / API auth) is. Only the `sharepoint` source (the documented
 * default, A25) has a real implementation; the others are `source-denied`
 * until Q16 (real system of record) is answered — building them now would be
 * guessing at integrations/credentials this repo doesn't have.
 */
export class TravelSpendService implements ITravelSpendService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    logger: Logger
  ) {
    this.log = logger.child('TravelSpendService');
  }

  public toEmbedUrl(url: string | undefined): string | undefined {
    return toPowerBiEmbedUrl(url, this.spo.tenantId);
  }

  public async getAccess(config: ITravelHubConfiguration): Promise<ITravelSpendAccess> {
    if (config.spend.source !== 'sharepoint') {
      return { hasAccess: false, reason: 'source-denied' };
    }
    try {
      const inGroup = await this.spo.isCurrentUserInGroup(config.spend.viewerGroup);
      return inGroup ? { hasAccess: true, reason: 'granted' } : { hasAccess: false, reason: 'not-in-group' };
    } catch {
      // Fail closed — an access-check failure must never default to showing spend figures.
      return { hasAccess: false, reason: 'not-in-group' };
    }
  }

  public async getSpend(config: ITravelHubConfiguration): Promise<ITravelSpend | undefined> {
    try {
      const raw = await this.spo.getListItems<IRawSpendItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        top: 1
      });
      const item = raw[0];
      if (item === undefined) {
        return undefined;
      }
      return {
        department: toStringOr(item.Title, 'Department'),
        period: toStringOr(item.Period, ''),
        currency: toStringOr(item.Currency, 'USD'),
        totalSpend: toNumber(item.TotalSpend, 0),
        airSpend: toNumber(item.AirSpend, 0),
        hotelSpend: toNumber(item.HotelSpend, 0),
        groundTransportSpend: toNumber(item.GroundTransportSpend, 0),
        bookingSpend: toNumber(item.BookingSpend, 0),
        // The link as configured (opens in a new tab). Frames use toEmbedUrl().
        dashboardUrl: sanitizeUrl(item.DashboardUrl?.Url) ?? sanitizeUrl(config.spend.dashboardUrl),
        source: config.spend.source
      };
    } catch (error) {
      this.log.error('Failed to read department travel spend', error);
      return undefined;
    }
  }
}
