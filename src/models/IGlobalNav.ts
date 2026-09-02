/** A single global navigation tab, shown above the hero banner. */
export interface IGlobalNavItem {
  /** Stable across renders — a small negative number for the 3 built-in tabs, the list item Id for admin-added ones. */
  id: number;
  title: string;
  /** Validated; `undefined` when invalid (the item is dropped). */
  url: string | undefined;
  /**
   * `app` = an existing destination already part of this app (the Our
   * Services anchor, or an admin-added same-tab link) — opens in the same
   * tab. `external` = an admin-added external link — always opens in a new
   * tab/window.
   */
  kind: 'app' | 'external';
  openInNewTab: boolean;
}
