/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelTeamMember, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl, toMailtoHref, toTelHref } from '../common/utils/urlValidation';
import { orderBy, toNumber, toOptionalString, toStringOr } from '../common/utils/collection';

const LIST = 'TH_TravelTeam';
const TTL_SECONDS = 600;

interface IRawTeamItem {
  Id: number;
  Title: string | null;
  Designation: string | null;
  Department: string | null;
  Specialization: string | null;
  ProfileImage: { Url: string } | null;
  Email: string | null;
  Phone: string | null;
  Location: string | null;
  DisplayOrder: number | null;
}

const SELECT = [
  'Id',
  'Title',
  'Designation',
  'Department',
  'Specialization',
  'ProfileImage',
  'Email',
  'Phone',
  'Location',
  'DisplayOrder'
];

export interface ITravelTeamService {
  /** Team members, capped at `team.landingPageCount` (ASSUMPTIONS A30). */
  getTeamMembers(config: ITravelHubConfiguration): Promise<ITravelTeamMember[]>;
  /** Every active team member, uncapped - backs the "View All Team Members" page. */
  getAllTeamMembers(): Promise<ITravelTeamMember[]>;
}

export class TravelTeamService implements ITravelTeamService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('TravelTeamService');
  }

  public async getTeamMembers(config: ITravelHubConfiguration): Promise<ITravelTeamMember[]> {
    const count = config.team.landingPageCount;
    return this.cache.getOrAdd(`team:${String(count)}`, TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawTeamItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: Math.max(count + 5, 15)
      });
      const mapped = raw.map((item) => this.mapMember(item));
      return orderBy(mapped, (m) => m.displayOrder).slice(0, count);
    });
  }

  public async getAllTeamMembers(): Promise<ITravelTeamMember[]> {
    return this.cache.getOrAdd('team:all', TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawTeamItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 500
      });
      return orderBy(raw.map((item) => this.mapMember(item)), (m) => m.displayOrder);
    });
  }

  private mapMember(item: IRawTeamItem): ITravelTeamMember {
    const profileImageUrl = sanitizeUrl(item.ProfileImage?.Url);
    if (item.ProfileImage?.Url !== undefined && profileImageUrl === undefined) {
      this.log.warn(`Team member ${String(item.Id)} has an unsafe ProfileImage URL; the photo will be hidden.`);
    }

    // SECURITY.md §4: mailto:/tel: are built from a sanitised value, never a
    // raw URL from the field. `toMailtoHref`/`toTelHref` validate + build the
    // full href; the bare value (stripped of its scheme) is what the model
    // holds, per ITravelTeamMember's own doc comment - the component re-adds
    // the scheme when it renders the link, so the same value also works as
    // display text.
    const mailtoHref = toMailtoHref(item.Email);
    const telHref = toTelHref(item.Phone);

    return {
      id: item.Id,
      name: toStringOr(item.Title, 'Team member'),
      designation: toStringOr(item.Designation, ''),
      department: toOptionalString(item.Department),
      specialization: toOptionalString(item.Specialization),
      profileImageUrl,
      email: mailtoHref?.slice('mailto:'.length),
      phone: telHref?.slice('tel:'.length),
      location: toOptionalString(item.Location),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }
}
