/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { IHeroBanner, IHeroContent, ITravelHubConfiguration, MediaType } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toBool, toNumber, toStringOr } from '../common/utils/collection';

const LIST = 'TH_HeroBanners';
const TTL_SECONDS = 300;

interface IRawHeroItem {
  Id: number;
  Title: string | null;
  Description: string | null;
  MediaType: string | null;
  ImageUrl: { Url: string } | null;
  MobileImageUrl: { Url: string } | null;
  VideoUrl: { Url: string } | null;
  AccessibilityText: string | null;
  DisplayOrder: number | null;
  AutoPlay: boolean | null;
  DurationSeconds: number | null;
  IsActive: boolean | null;
  StartDate: string | null;
  EndDate: string | null;
}

const SELECT = [
  'Id',
  'Title',
  'Description',
  'MediaType',
  'ImageUrl',
  'MobileImageUrl',
  'VideoUrl',
  'AccessibilityText',
  'DisplayOrder',
  'AutoPlay',
  'DurationSeconds',
  'IsActive',
  'StartDate',
  'EndDate'
];

export interface IHeroBannerService {
  /** Slides + (config-driven) quick links + supporting message for the hero section. */
  getContent(config: ITravelHubConfiguration): Promise<IHeroContent>;
}

export class HeroBannerService implements IHeroBannerService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('HeroBannerService');
  }

  public async getContent(config: ITravelHubConfiguration): Promise<IHeroContent> {
    const slides = await this.getSlides(config.featureFlags.heroVideo !== false);
    return {
      slides,
      quickLinks: config.hero.quickLinks.filter((link) => link.url !== undefined || link.badgeText !== undefined || link.title.length > 0),
      supportingMessage: config.hero.supportingMessage
    };
  }

  private async getSlides(allowVideo: boolean): Promise<IHeroBanner[]> {
    return this.cache.getOrAdd(`hero:slides:${String(allowVideo)}`, TTL_SECONDS, async () => {
      const nowIso = new Date().toISOString();
      const raw = await this.spo.getListItems<IRawHeroItem>({
        list: LIST,
        select: SELECT,
        filter: `IsActive eq 1 and (StartDate eq null or StartDate le datetime'${nowIso}') and (EndDate eq null or EndDate ge datetime'${nowIso}')`,
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 20
      });

      const mapped: IHeroBanner[] = [];
      for (const item of raw) {
        const slide = this.mapSlide(item, allowVideo);
        if (slide !== undefined) {
          mapped.push(slide);
        }
      }
      return orderBy(mapped, (s) => s.displayOrder);
    });
  }

  private mapSlide(item: IRawHeroItem, allowVideo: boolean): IHeroBanner | undefined {
    const mediaType: MediaType = (item.MediaType ?? 'image').toLowerCase() === 'video' ? 'video' : 'image';
    const imageUrl = sanitizeUrl(item.ImageUrl?.Url);
    const mobileImageUrl = sanitizeUrl(item.MobileImageUrl?.Url);
    const videoUrl = sanitizeUrl(item.VideoUrl?.Url);

    if (mediaType === 'video') {
      if (!allowVideo) {
        return undefined;
      }
      if (videoUrl === undefined) {
        this.log.warn(`Hero item ${String(item.Id)} is a video but has no valid VideoUrl; skipped.`);
        return undefined;
      }
    } else if (imageUrl === undefined) {
      this.log.warn(`Hero item ${String(item.Id)} is an image but has no valid ImageUrl; skipped.`);
      return undefined;
    }

    return {
      id: item.Id,
      title: toStringOr(item.Title, ''),
      description: toStringOr(item.Description, ''),
      mediaType,
      imageUrl,
      mobileImageUrl: mobileImageUrl ?? imageUrl,
      videoUrl,
      accessibilityText: toStringOr(item.AccessibilityText, toStringOr(item.Title, 'Travel Hub banner')),
      displayOrder: toNumber(item.DisplayOrder, 0),
      autoPlay: toBool(item.AutoPlay, true),
      // Only meaningful for image slides (how long they stay on screen before
      // the shared hero.intervalSeconds timer advances). Video slides ignore
      // this and instead advance on the video's own `ended` event, so a long
      // video always plays out fully — that's why the ceiling is well above
      // the old 30s (which used to clamp a configured value pointlessly).
      durationSeconds: toNumber(item.DurationSeconds, 6, { min: 3, max: 600 })
    };
  }
}
