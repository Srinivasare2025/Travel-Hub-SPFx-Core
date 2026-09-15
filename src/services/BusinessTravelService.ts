/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IBusinessTravelInfoCard, IBusinessTravelStep } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { safeColor } from '../common/utils/color';
import { orderBy, toBool, toNumber, toStringOr } from '../common/utils/collection';

const STEPS_LIST = 'TH_BusinessTravelSteps';
const INFO_LIST = 'TH_BusinessTravelInfoCards';
const TTL_SECONDS = 300;

interface IRawStep {
  Id: number;
  Title: string | null;
  Description: string | null;
  Number: number | null;
  BackgroundColor: string | null;
  DisplayOrder: number | null;
}

interface IRawInfoCard {
  Id: number;
  Title: string | null;
  Description: string | null;
  LinkUrl: { Url: string } | null;
  LinkText: string | null;
  OpenInNewTab: boolean | null;
  DisplayOrder: number | null;
}

const STEP_SELECT = ['Id', 'Title', 'Description', 'Number', 'BackgroundColor', 'DisplayOrder'];
const INFO_SELECT = ['Id', 'Title', 'Description', 'LinkUrl', 'LinkText', 'OpenInNewTab', 'DisplayOrder'];

export interface IBusinessTravelService {
  /** The 5 process-step cards (Raise Request, Approval, Book, Travel, Expense, …). */
  getSteps(): Promise<IBusinessTravelStep[]>;
  /** The 3 info cards below the steps (Policy reminders, Useful Documents, Need further help?, …). */
  getInfoCards(): Promise<IBusinessTravelInfoCard[]>;
}

/** Content for the dedicated Business Travel page (`NavigationContext`'s `businessTravel` view). */
export class BusinessTravelService implements IBusinessTravelService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('BusinessTravelService');
  }

  public async getSteps(): Promise<IBusinessTravelStep[]> {
    return this.cache.getOrAdd('businessTravelSteps', TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawStep>({
        list: STEPS_LIST,
        select: STEP_SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 20
      });
      const mapped = raw.map((item) => ({
        id: item.Id,
        number: toNumber(item.Number, item.Id),
        title: toStringOr(item.Title, 'Untitled step'),
        description: toStringOr(item.Description, ''),
        backgroundColor: safeColor(item.BackgroundColor, 'var(--full-primary, #b89c66)'),
        displayOrder: toNumber(item.DisplayOrder, 0)
      }));
      return orderBy(mapped, (s) => s.displayOrder);
    });
  }

  public async getInfoCards(): Promise<IBusinessTravelInfoCard[]> {
    return this.cache.getOrAdd('businessTravelInfoCards', TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawInfoCard>({
        list: INFO_LIST,
        select: INFO_SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 20
      });
      const mapped = raw.map((item) => this.mapInfoCard(item));
      return orderBy(mapped, (c) => c.displayOrder);
    });
  }

  private mapInfoCard(item: IRawInfoCard): IBusinessTravelInfoCard {
    const linkUrl = sanitizeUrl(item.LinkUrl?.Url);
    if (item.LinkUrl?.Url !== undefined && linkUrl === undefined) {
      this.log.warn(`Business Travel info card ${String(item.Id)} has an unsafe LinkUrl; the "View" link will be hidden.`);
    }
    return {
      id: item.Id,
      title: toStringOr(item.Title, 'Untitled'),
      description: toStringOr(item.Description, ''),
      linkUrl,
      linkText: toStringOr(item.LinkText, 'View'),
      openInNewTab: toBool(item.OpenInNewTab, false),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }
}
