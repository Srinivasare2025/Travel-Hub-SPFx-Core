import { spfi, SPFI, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/site-users/web';
import '@pnp/sp/site-groups/web';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { Logger } from './Logger';

/**
 * Owns the single PnPjs (SPFI) instance for the web part and exposes narrow,
 * typed helpers. This is the only module that imports PnPjs directly; feature
 * services depend on this class, not on `@pnp/sp`.
 *
 * All calls run as the signed-in user and inherit that user's SharePoint
 * permissions (SECURITY.md §1).
 */
export class SharePointService {
  public readonly sp: SPFI;
  private readonly log: Logger;
  private groupNamesPromise: Promise<Set<string>> | undefined;

  public constructor(context: WebPartContext, logger: Logger) {
    this.sp = spfi().using(SPFx(context));
    this.log = logger.child('SharePointService');
  }

  /**
   * Read items from a list with explicit field selection, server-side filter and
   * order, and a hard cap. Callers pass a narrow `TRaw` describing only the
   * fields in `select`.
   */
  public async getListItems<TRaw>(options: {
    list: string;
    select: string[];
    filter?: string;
    orderBy?: { field: string; ascending?: boolean };
    top: number;
    expand?: string[];
  }): Promise<TRaw[]> {
    const { list, select, filter, orderBy, top, expand } = options;
    try {
      let query = this.sp.web.lists.getByTitle(list).items.select(...select).top(top);
      if (expand !== undefined && expand.length > 0) {
        query = query.expand(...expand);
      }
      if (filter !== undefined && filter.length > 0) {
        query = query.filter(filter);
      }
      if (orderBy !== undefined) {
        query = query.orderBy(orderBy.field, orderBy.ascending ?? true);
      }
      return (await query()) as TRaw[];
    } catch (error) {
      this.log.error(`Failed to read list "${list}"`, error);
      throw error;
    }
  }

  /** Add an item to a list. Returns the new item id. */
  public async addListItem(list: string, data: Record<string, unknown>): Promise<number> {
    try {
      const result = await this.sp.web.lists.getByTitle(list).items.add(data);
      // PnPjs v4 returns the created item body.
      const id = (result as { Id?: number; ID?: number }).Id ?? (result as { ID?: number }).ID;
      return typeof id === 'number' ? id : 0;
    } catch (error) {
      this.log.error(`Failed to add item to list "${list}"`, error);
      throw error;
    }
  }

  /** Count items matching a filter (used for duplicate-submission checks). */
  public async countItems(list: string, filter: string): Promise<number> {
    try {
      const items = await this.sp.web.lists
        .getByTitle(list)
        .items.select('Id')
        .filter(filter)
        .top(1)();
      return items.length;
    } catch (error) {
      this.log.error(`Failed to count items in list "${list}"`, error);
      throw error;
    }
  }

  /** The current user's login name (UPN) and display name. */
  public async getCurrentUser(): Promise<{ loginName: string; email: string; displayName: string }> {
    const user = await this.sp.web.currentUser();
    return {
      loginName: user.LoginName,
      email: user.Email,
      displayName: user.Title
    };
  }

  /**
   * Whether the current user belongs to a SharePoint group. Used by security
   * services to gate reporting/admin features. The list-level permission is the
   * real control; this only drives UI affordances (SECURITY.md §2/§3).
   */
  public async isCurrentUserInGroup(groupName: string): Promise<boolean> {
    if (groupName.trim().length === 0) {
      return false;
    }
    try {
      const groups = await this.getCurrentUserGroupNames();
      return groups.has(groupName.toLowerCase());
    } catch {
      this.log.warn(`Group membership check failed for "${groupName}"; treating as not a member`);
      return false;
    }
  }

  private async getCurrentUserGroupNames(): Promise<Set<string>> {
    if (this.groupNamesPromise === undefined) {
      this.groupNamesPromise = this.sp.web.currentUser
        .groups()
        .then((groups) => new Set(groups.map((g) => (g.Title ?? '').toLowerCase())));
    }
    return this.groupNamesPromise;
  }
}
