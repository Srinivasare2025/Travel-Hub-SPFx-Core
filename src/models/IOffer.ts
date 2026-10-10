import type { IMediaItem } from '../common/utils/mediaItems';

/**
 * What clicking an offer card does (TH_Offers.ClickAction, resolved):
 * - `details` - opens the in-app offer details screen (OfferDetailScreen).
 * - `popup`   - opens its files (attachments / PopupContent) in the popup viewer.
 * - `link`    - follows LinkUrl (a new tab when it's an external site).
 * - `none`    - informational card.
 */
export type OfferAction = 'details' | 'popup' | 'link' | 'none';

/**
 * One row of TH_Offers - a list-maintained card shown in a page section whose
 * `OfferCollection` names its Collection: Featured Personal Travel Offers,
 * the "Explore Our Personal Travel Offers" tiles, Riyadh / Jeddah partnered
 * hotels, … Editors add, update, reorder and expire these without touching
 * the page's sections.
 */
export interface IOffer {
  id: number;
  collection: string;
  title: string;
  subtitle: string | undefined;
  /** Pill on the photo, e.g. "Special Offer". */
  badge: string | undefined;
  /** Short text on the card and under the title on the details screen. */
  summary: string;
  /** Details screen body - one paragraph/bullet per line (SubPoints markup). */
  details: string[];
  /** "What's included" - one item per line. */
  inclusions: string[];
  /** Terms & conditions - one paragraph/bullet per line. */
  terms: string[];
  /** Card photo (CardImage upload, else ImageUrl). */
  imageUrl: string | undefined;
  /** Partner/brand logo (Logo upload, else LogoUrl), e.g. a hotel logo. */
  logoUrl: string | undefined;
  icon: string | undefined;
  iconColor: string | undefined;
  iconColorOn: string | undefined;
  iconColorInk: string | undefined;
  valueLabel: string | undefined;
  value: string | undefined;
  valueNote: string | undefined;
  /** Offer provider, e.g. "Saudia Holidays". */
  partner: string | undefined;
  /** e.g. "Maldives" / "KAFD, Riyadh". */
  location: string | undefined;
  validFrom: Date | undefined;
  validTo: Date | undefined;
  /** Card button text, e.g. "View Details" / "View Gallery". */
  linkText: string | undefined;
  /** Offer source / booking link (validated). */
  linkUrl: string | undefined;
  /** `linkUrl` points to another site - opened in a new tab. */
  linkIsExternal: boolean;
  /** Details screen main button text (default "View Offer"). */
  ctaText: string | undefined;
  contactEmail: string | undefined;
  contactPhone: string | undefined;
  /** Item attachments (sorted by file name) + PopupContent lines: images and PDFs. */
  files: IMediaItem[];
  action: OfferAction;
  displayOrder: number;
}
