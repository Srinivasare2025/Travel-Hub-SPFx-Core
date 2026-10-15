import '@pnp/sp/fields';
import '@pnp/sp/files';
import '@pnp/sp/folders';
import type { ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import type { ICache } from './base/MemoryCache';
import { Logger } from './base/Logger';

/** A raw list row as the admin screen sees it (field internal name -> value). */
export type AdminRow = Record<string, unknown> & { Id: number };

export interface IAdminQuery {
  list: string;
  select: string[];
  filter?: string;
  orderBy?: { field: string; ascending?: boolean };
  top?: number;
}

export interface IAdminService {
  /** Whether the current user is in the Content Admin group (`admin.group`) - drives the Admin tab only; list permissions are the real control. */
  canAccess(config: ITravelHubConfiguration): Promise<boolean>;
  /** Internal names of the fields that exist on a list (so the editor hides fields not provisioned yet). */
  getFieldNames(list: string): Promise<Set<string>>;
  getItems(query: IAdminQuery): Promise<AdminRow[]>;
  addItem(list: string, data: Record<string, unknown>): Promise<number>;
  updateItem(list: string, id: number, data: Record<string, unknown>): Promise<void>;
  /** Moves the item to the site Recycle Bin (restorable for 93 days). */
  recycleItem(list: string, id: number): Promise<void>;
  /** Uploads an image to the "Travel Hub Images" library; returns its absolute URL. */
  uploadImage(file: File): Promise<string>;
  /** Empties the in-memory data cache so the app shows saved changes on the next screen load. */
  clearCache(): void;
}

const IMAGE_LIBRARY = 'Travel Hub Images';
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Data access for the Content Admin screen (components/Admin). Every call runs
 * as the signed-in user (SECURITY.md §1): SharePoint enforces who may add,
 * edit or delete in each list - the admin group check only decides whether
 * the Admin tab is shown.
 */
export class AdminService implements IAdminService {
  private readonly log: Logger;
  private readonly fieldCache = new Map<string, Promise<Set<string>>>();

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('AdminService');
  }

  public canAccess(config: ITravelHubConfiguration): Promise<boolean> {
    return this.spo.isCurrentUserInGroup(config.admin.group);
  }

  public getFieldNames(list: string): Promise<Set<string>> {
    let pending = this.fieldCache.get(list);
    if (pending === undefined) {
      pending = this.spo.sp.web.lists
        .getByTitle(list)
        .fields.select('InternalName')
        .filter('Hidden eq false')()
        .then((fields) => new Set(fields.map((f) => (f as { InternalName: string }).InternalName)));
      pending.catch(() => this.fieldCache.delete(list));
      this.fieldCache.set(list, pending);
    }
    return pending;
  }

  public async getItems(query: IAdminQuery): Promise<AdminRow[]> {
    return this.spo.getListItems<AdminRow>({
      list: query.list,
      select: query.select,
      filter: query.filter,
      orderBy: query.orderBy,
      top: query.top ?? 500
    });
  }

  public async addItem(list: string, data: Record<string, unknown>): Promise<number> {
    const id = await this.spo.addListItem(list, data);
    this.cache.clear();
    return id;
  }

  public async updateItem(list: string, id: number, data: Record<string, unknown>): Promise<void> {
    try {
      await this.spo.sp.web.lists.getByTitle(list).items.getById(id).update(data);
      this.cache.clear();
    } catch (error) {
      this.log.error(`Failed to update item ${String(id)} in "${list}"`, error);
      throw error;
    }
  }

  public async recycleItem(list: string, id: number): Promise<void> {
    try {
      await this.spo.sp.web.lists.getByTitle(list).items.getById(id).recycle();
      this.cache.clear();
    } catch (error) {
      this.log.error(`Failed to delete item ${String(id)} in "${list}"`, error);
      throw error;
    }
  }

  public async uploadImage(file: File): Promise<string> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('The image is larger than 15 MB. Please use a smaller (web-optimised) image.');
    }
    if (!/^image\//.test(file.type)) {
      throw new Error('Only image files (JPG, PNG, WebP, GIF, SVG) can be uploaded here.');
    }
    const safeName = file.name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-') || 'image';
    const dot = safeName.lastIndexOf('.');
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const name = dot > 0 ? `${safeName.slice(0, dot)}-${stamp}${safeName.slice(dot)}` : `${safeName}-${stamp}`;
    const libraryRoot = await this.spo.sp.web.lists.getByTitle(IMAGE_LIBRARY).rootFolder.select('ServerRelativeUrl')();
    const folderUrl = (libraryRoot as { ServerRelativeUrl: string }).ServerRelativeUrl;
    await this.spo.sp.web.getFolderByServerRelativePath(folderUrl).files.addUsingPath(name, file, { Overwrite: false });
    const origin = new URL(this.spo.webAbsoluteUrl).origin;
    return `${origin}${encodeURI(`${folderUrl}/${name}`)}`;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}
