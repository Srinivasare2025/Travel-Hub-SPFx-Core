/** A card in the "Explore Our Travel Services" carousel (from TH_TravelServices). */
export interface ITravelService {
  id: number;
  title: string;
  description: string;
  /** Validated image URL; `undefined` when invalid/missing (card shows icon only). */
  imageUrl: string | undefined;
  /** Fluent UI icon name or asset key. */
  icon: string;
  /** Validated CSS colour (hex or token name) for the icon chip background. */
  iconBackgroundColor: string;
  /** Validated destination; `undefined` when invalid (action link hidden). */
  linkUrl: string | undefined;
  linkType: 'internal' | 'external';
  openInNewTab: boolean;
  /** e.g. "Learn More"; falls back to `services.defaultLinkText`. */
  linkText: string;
  displayOrder: number;
}
