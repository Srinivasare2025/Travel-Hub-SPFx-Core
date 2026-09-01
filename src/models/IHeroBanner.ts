import { MediaType } from './common';

/** A single hero carousel slide (from TH_HeroBanners). */
export interface IHeroBanner {
  id: number;
  title: string;
  description: string;
  mediaType: MediaType;
  /** Desktop image URL. Present and validated for `mediaType === 'image'`. */
  imageUrl: string | undefined;
  /** Optional mobile-optimised image; falls back to `imageUrl`. */
  mobileImageUrl: string | undefined;
  /** Present and validated for `mediaType === 'video'`. */
  videoUrl: string | undefined;
  /** alt / aria-label text for the slide media. */
  accessibilityText: string;
  displayOrder: number;
  /** Per-slide autoplay preference. */
  autoPlay: boolean;
  /** Seconds this slide stays visible before advancing. */
  durationSeconds: number;
}

/** One of the two static links overlaid on the hero (not part of the carousel). */
export interface IHeroQuickLink {
  key: 'helpDesk' | 'travelCare';
  title: string;
  description: string;
  /** Validated; `undefined` when the configured value failed URL validation. */
  url: string | undefined;
  /**
   * `page` = a normal destination page. `image` = the URL points at an image
   * (e.g. a poster with QR codes); opening it shows the raw image so the viewer
   * can scan it. Configurable per link.
   */
  kind: 'page' | 'image';
  /** Whether to open in a new browser tab/window. Configurable; defaults to true. */
  openInNewTab: boolean;
  /** e.g. "24/7"; `undefined` when not set. */
  badgeText: string | undefined;
}

/** Everything the HeroBanner section needs. */
export interface IHeroContent {
  slides: IHeroBanner[];
  quickLinks: IHeroQuickLink[];
  supportingMessage: string;
}
