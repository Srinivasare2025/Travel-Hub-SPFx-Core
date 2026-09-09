/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IFooterColumn, IFooterContent, IFooterLink, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toBool, toNumber, toOptionalString, toStringOr } from '../common/utils/collection';

const COLUMNS_LIST = 'TH_FooterColumns';
const LINKS_LIST = 'TH_FooterLinks';
const TTL_SECONDS = 600;

interface IRawColumn {
  Id: number;
  Title: string | null;
  DisplayOrder: number | null;
}

interface IRawLink {
  Id: number;
  Title: string | null;
  ColumnIdId: number | null;
  Url: { Url: string } | null;
  Icon: string | null;
  OpenInNewTab: boolean | null;
  DisplayOrder: number | null;
}

export interface IFooterService {
  getContent(config: ITravelHubConfiguration): Promise<IFooterContent>;
}

/** ASSUMPTIONS A33-A35: up to 6 fully list-driven columns; the brand block
 * (copyright/"Last Updated"/QR) is configuration, not hard-coded. */
export class FooterService implements IFooterService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('FooterService');
  }

  public async getContent(config: ITravelHubConfiguration): Promise<IFooterContent> {
    const columns = await this.cache.getOrAdd('footer:columns', TTL_SECONDS, () => this.getColumns());
    return {
      columns,
      legalText: this.composeLegalText(config),
      lastUpdatedText: toOptionalString(config.footer.lastUpdatedText),
      qrCodeUrl: config.footer.showQrCode ? sanitizeUrl(config.footer.qrCodeUrl) : undefined
    };
  }

  private async getColumns(): Promise<IFooterColumn[]> {
    const [rawColumns, rawLinks] = await Promise.all([
      this.spo.getListItems<IRawColumn>({
        list: COLUMNS_LIST,
        select: ['Id', 'Title', 'DisplayOrder'],
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 10
      }),
      this.spo.getListItems<IRawLink>({
        list: LINKS_LIST,
        select: ['Id', 'Title', 'ColumnIdId', 'Url', 'Icon', 'OpenInNewTab', 'DisplayOrder'],
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 100
      })
    ]);

    const linksByColumn = new Map<number, IFooterLink[]>();
    for (const raw of rawLinks) {
      const url = sanitizeUrl(raw.Url?.Url);
      if (url === undefined) {
        this.log.warn(`Footer link ${String(raw.Id)} has no valid Url; skipped.`);
        continue;
      }
      const columnId = raw.ColumnIdId ?? 0;
      const link: IFooterLink = {
        id: raw.Id,
        columnId,
        title: toStringOr(raw.Title, ''),
        url,
        icon: toOptionalString(raw.Icon),
        openInNewTab: toBool(raw.OpenInNewTab, false),
        displayOrder: toNumber(raw.DisplayOrder, 0)
      };
      const existing = linksByColumn.get(columnId) ?? [];
      existing.push(link);
      linksByColumn.set(columnId, existing);
    }

    const columns: IFooterColumn[] = rawColumns.map((raw) => ({
      id: raw.Id,
      title: toStringOr(raw.Title, ''),
      displayOrder: toNumber(raw.DisplayOrder, 0),
      links: orderBy(linksByColumn.get(raw.Id) ?? [], (l) => l.displayOrder)
    }));

    return orderBy(
      columns.filter((c) => c.links.length > 0),
      (c) => c.displayOrder
    );
  }

  private composeLegalText(config: ITravelHubConfiguration): string {
    return config.footer.legalText
      .replace('{year}', String(new Date().getFullYear()))
      .replace('{brand}', config.brandName);
  }
}
