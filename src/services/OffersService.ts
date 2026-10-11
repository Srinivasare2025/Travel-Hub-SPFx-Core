/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IOffer, OfferAction } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { isExternalUrl, sanitizeUrl, toMailtoHref } from '../common/utils/urlValidation';
import { orderBy, toNumber, toOptionalString, toStringOr } from '../common/utils/collection';
import { resolveColor } from '../common/utils/color';
import { guessMediaKind, IMediaItem, parseMediaItems } from '../common/utils/mediaItems';

const LIST = 'TH_Offers';
const TTL_SECONDS = 300;

interface IRawAttachment {
  FileName: string;
  ServerRelativeUrl: string;
}

interface IRawOffer {
  Id: number;
  Title: string | null;
  Collection: string | null;
  Subtitle: string | null;
  Badge: string | null;
  Summary: string | null;
  Details: string | null;
  Inclusions: string | null;
  Terms: string | null;
  ImageUrl: { Url: string } | null;
  LogoUrl: { Url: string } | null;
  Icon: string | null;
  IconColor: string | null;
  ValueLabel: string | null;
  Value: string | null;
  ValueNote: string | null;
  Partner: string | null;
  Location: string | null;
  ValidFrom: string | null;
  ValidTo: string | null;
  ClickAction: string | null;
  LinkText: string | null;
  LinkUrl: { Url: string } | null;
  CtaText: string | null;
  ContactEmail: string | null;
  ContactPhone: string | null;
  PopupContent: string | null;
  DisplayOrder: number | null;
  AttachmentFiles?: IRawAttachment[];
  // SharePoint "Image" (Thumbnail) columns - a JSON string (or object) with serverRelativeUrl.
  CardImage?: string | { serverRelativeUrl?: string; serverUrl?: string } | null;
  Logo?: string | { serverRelativeUrl?: string; serverUrl?: string } | null;
}

const BASE_SELECT = [
  'Id', 'Title', 'Collection', 'Subtitle', 'Badge', 'Summary', 'Details', 'Inclusions', 'Terms', 'ImageUrl', 'LogoUrl',
  'Icon', 'IconColor', 'ValueLabel', 'Value', 'ValueNote', 'Partner', 'Location', 'ValidFrom', 'ValidTo', 'ClickAction',
  'LinkText', 'LinkUrl', 'CtaText', 'ContactEmail', 'ContactPhone', 'PopupContent', 'DisplayOrder', 'AttachmentFiles'
];
/** With the two "Image" upload columns - falls back to BASE_SELECT on a site where they couldn't be created. */
const FULL_SELECT = [...BASE_SELECT, 'CardImage', 'Logo'];
const EXPAND = ['AttachmentFiles'];

/** "02 - Jeddah Guide.pdf" -> "Jeddah Guide": the attachment's label in the popup. */
export function attachmentLabel(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+\s*[-_.)]\s*/, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

/** Attachments sorted by file name (numbers in natural order), so "1-", "2-", … controls the popup order. */
export function attachmentsToMedia(files: ReadonlyArray<IRawAttachment> | undefined): IMediaItem[] {
  return [...(files ?? [])]
    .sort((a, b) => a.FileName.localeCompare(b.FileName, undefined, { numeric: true, sensitivity: 'base' }))
    .map((f) => ({ url: sanitizeUrl(f.ServerRelativeUrl), label: attachmentLabel(f.FileName) }))
    .filter((f): f is { url: string; label: string } => f.url !== undefined)
    .map((f) => ({ label: f.label, url: f.url, kind: guessMediaKind(f.url) }));
}

/** The URL of a SharePoint "Image" (Thumbnail) column value. */
export function thumbnailUrl(value: IRawOffer['CardImage']): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  let parsed: { serverRelativeUrl?: string; serverUrl?: string };
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as { serverRelativeUrl?: string; serverUrl?: string };
    } catch {
      return undefined;
    }
  } else {
    parsed = value;
  }
  return sanitizeUrl(parsed.serverRelativeUrl ?? undefined);
}

function toDate(value: string | null | undefined): Date | undefined {
  if (value === null || value === undefined || value.length === 0) {
    return undefined;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function lines(value: string | null | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Picks what a click does. `Auto` (default): files -> popup unless the offer
 * has details content, details content -> details screen, else LinkUrl.
 */
export function resolveOfferAction(
  choice: string | null,
  has: { files: boolean; details: boolean; link: boolean }
): OfferAction {
  const c = (choice ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (c.indexOf('detail') === 0) {
    return 'details';
  }
  if (c.indexOf('popup') === 0 && has.files) {
    return 'popup';
  }
  if (c === 'link' && has.link) {
    return 'link';
  }
  if (c === 'none') {
    return 'none';
  }
  if (has.details) {
    return 'details';
  }
  if (has.files) {
    return 'popup';
  }
  return has.link ? 'link' : 'none';
}

export interface IOffersService {
  /** Active, in-date offers per Collection name (case-insensitive key), in DisplayOrder. */
  getCollections(names: string[]): Promise<Map<string, IOffer[]>>;
  /** One offer for the details screen, or `undefined` if missing/inactive. */
  getOffer(id: number): Promise<IOffer | undefined>;
}

/**
 * TH_Offers - list-maintained offer / partner cards, grouped by Collection
 * and shown by any page section whose `OfferCollection` names that
 * collection (PolicyService). Files attached to an item (images, PDFs) are
 * its popup content - the easiest way for editors to add "City Guide" PDFs
 * or a hotel's gallery.
 */
export class OffersService implements IOffersService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('OffersService');
  }

  public async getCollections(names: string[]): Promise<Map<string, IOffer[]>> {
    const unique = Array.from(new Set(names.map((n) => n.trim()).filter((n) => n.length > 0)));
    const result = new Map<string, IOffer[]>();
    if (unique.length === 0) {
      return result;
    }
    const key = `offers:${unique.map((n) => n.toLowerCase()).sort().join('|')}`;
    const offers = await this.cache.getOrAdd(key, TTL_SECONDS, async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const dayAgo = new Date(today.getTime() - 24 * 3600 * 1000).toISOString();
      const now = new Date().toISOString();
      const collectionFilter = unique.map((n) => `Collection eq '${n.replace(/'/g, "''")}'`).join(' or ');
      const filter =
        `IsActive eq 1 and (${collectionFilter}) and (ValidFrom eq null or ValidFrom le datetime'${now}') ` +
        `and (ValidTo eq null or ValidTo ge datetime'${dayAgo}')`;
      return this.query(filter, 500);
    });
    offers.forEach((offer) => {
      const k = offer.collection.toLowerCase();
      result.set(k, [...(result.get(k) ?? []), offer]);
    });
    result.forEach((list, k) => result.set(k, orderBy(list, (o) => o.displayOrder, (o) => o.id)));
    return result;
  }

  public async getOffer(id: number): Promise<IOffer | undefined> {
    if (!isFinite(id) || id <= 0) {
      return undefined;
    }
    return this.cache.getOrAdd(`offer:${String(id)}`, TTL_SECONDS, async () => {
      const rows = await this.query(`IsActive eq 1 and Id eq ${String(Math.floor(id))}`, 1);
      return rows[0];
    });
  }

  private async query(filter: string, top: number): Promise<IOffer[]> {
    const options = { list: LIST, filter, top, expand: EXPAND, orderBy: { field: 'DisplayOrder', ascending: true } };
    const raw = await this.spo
      .getListItems<IRawOffer>({ ...options, select: FULL_SELECT })
      .catch((error: unknown) => {
        this.log.warn(`"${LIST}" query with the Image columns failed - retrying without them. ${String(error)}`);
        return this.spo.getListItems<IRawOffer>({ ...options, select: BASE_SELECT });
      });
    return raw.map((item) => this.map(item));
  }

  private map(item: IRawOffer): IOffer {
    const color = resolveColor(item.IconColor);
    const linkUrl = sanitizeUrl(item.LinkUrl?.Url);
    const files = [...attachmentsToMedia(item.AttachmentFiles), ...parseMediaItems(lines(item.PopupContent))];
    const details = lines(item.Details);
    const inclusions = lines(item.Inclusions);
    const usableLink = linkUrl !== undefined && linkUrl !== '#' ? linkUrl : undefined;
    return {
      id: item.Id,
      collection: toStringOr(item.Collection, ''),
      title: toStringOr(item.Title, 'Untitled offer'),
      subtitle: toOptionalString(item.Subtitle),
      badge: toOptionalString(item.Badge),
      summary: toStringOr(item.Summary, ''),
      details,
      inclusions,
      terms: lines(item.Terms),
      imageUrl: thumbnailUrl(item.CardImage) ?? sanitizeUrl(item.ImageUrl?.Url),
      logoUrl: thumbnailUrl(item.Logo) ?? sanitizeUrl(item.LogoUrl?.Url),
      icon: toOptionalString(item.Icon),
      iconColor: color?.value,
      iconColorOn: color?.on,
      iconColorInk: color?.ink,
      valueLabel: toOptionalString(item.ValueLabel),
      value: toOptionalString(item.Value),
      valueNote: toOptionalString(item.ValueNote),
      partner: toOptionalString(item.Partner),
      location: toOptionalString(item.Location),
      validFrom: toDate(item.ValidFrom),
      validTo: toDate(item.ValidTo),
      linkText: toOptionalString(item.LinkText),
      linkUrl: usableLink,
      linkIsExternal: isExternalUrl(usableLink),
      ctaText: toOptionalString(item.CtaText),
      contactEmail: toMailtoHref(item.ContactEmail)?.slice('mailto:'.length),
      contactPhone: toOptionalString(item.ContactPhone),
      files,
      action: resolveOfferAction(item.ClickAction, {
        files: files.length > 0,
        details: details.length > 0 || inclusions.length > 0,
        link: usableLink !== undefined
      }),
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }
}
