import { LinkType } from './common';

/** Travel News & Articles item (from TH_TravelNews). */
export interface ITravelNews {
  id: number;
  title: string;
  description: string;
  imageUrl: string | undefined;
  publishDate: Date;
  linkType: LinkType;
  /** Validated; `undefined` when invalid. `onPremReference` = absolute URL to the legacy farm. */
  targetUrl: string | undefined;
  category: string | undefined;
  openInNewTab: boolean;
  displayOrder: number;
  /** Derived: the first item by (isFeatured desc, displayOrder, publishDate desc). */
  isFeatured: boolean;
}

/** Upcoming Events item (from TH_TravelEvents). */
export interface ITravelEvent {
  id: number;
  title: string;
  description: string;
  eventDate: Date;
  /** Display strings, e.g. "09:00". */
  startTime: string | undefined;
  endTime: string | undefined;
  location: string | undefined;
  category: string | undefined;
  imageUrl: string | undefined;
  registrationUrl: string | undefined;
  displayOrder: number;
}

/** Travel Tips & Insights item (from TH_TravelTips). */
export interface ITravelTip {
  id: number;
  /** The tip text. */
  title: string;
  description: string | undefined;
  icon: string;
  category: string | undefined;
  linkUrl: string | undefined;
  displayOrder: number;
}
