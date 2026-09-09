/** A single global navigation tab, shown above the hero banner. */
export interface IGlobalNavItem {
  /** Stable across renders — 0 or a small negative number for the built-in tabs, the list item Id for admin-added ones. */
  id: number;
  title: string;
  /**
   * Validated for `app`/`external`; `undefined` when invalid (the item is
   * dropped). For `policy`/`service` this holds a routing key instead of a
   * real href (a `TH_PolicyPages` slug / a `TH_TravelServices` id, as a
   * string) — see `kind`. For `image` this holds the validated image URL
   * shown in the popup, not a navigable href.
   */
  url: string | undefined;
  /**
   * `home` = the built-in first tab, always present - `GlobalNav` calls
   * `navigate({ kind: 'hub' })`; the only way back to the hub from a
   * sub-screen that isn't the hero-photo carousel itself. `app` = an
   * existing destination already part of this app (an admin-added same-tab
   * link, or a hero quick link whose `type` is `page`) — opens in the same
   * tab. `external` = an admin-added external link — always opens in a new
   * tab/window. `policy` = the built-in Travel Policy tab — `url` holds the
   * target `TH_PolicyPages` slug; `GlobalNav` intercepts it and calls
   * `navigate({ kind: 'policyPage', slug })` instead of following it.
   * `service` = one of the other Travel Services tabs - `url` holds the
   * `TH_TravelServices` row's id (as a string); `GlobalNav` calls
   * `navigate({ kind: 'servicePage', serviceId })`. `image` = a hero quick
   * link whose `type` is `image` (e.g. Travel Care's QR poster) - `GlobalNav`
   * opens the same in-app `ImageLightbox` the hero card does, instead of
   * navigating the browser to the raw file URL.
   */
  kind: 'home' | 'app' | 'external' | 'policy' | 'service' | 'image';
  openInNewTab: boolean;
}
