/**
 * Cross-cutting model types shared by many entities.
 */

/** Finite state for any async section load. Drives loading / success / empty / error UI. */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

/** A value that varies by viewport. Card counts come from configuration. */
export interface IResponsive<T> {
  desktop: T;
  tablet: T;
  mobile: T;
}

/** How a link should be resolved and where it should open. */
export type LinkType = 'internal' | 'external' | 'onPremReference';

/** Hero / media slide type. */
export type MediaType = 'image' | 'video';

/** A validated, ready-to-render link. `url` is `undefined` when the source value failed URL validation. */
export interface ISafeLink {
  url: string | undefined;
  text: string;
  openInNewTab: boolean;
  linkType: LinkType;
}

/** Section keys used for configuration-driven visibility and ordering. */
export type SectionKey =
  | 'hero'
  | 'travelServices'
  | 'travelUpdates'
  | 'travelerEngagement'
  | 'travelInsights'
  | 'travelTeam'
  | 'footer';
