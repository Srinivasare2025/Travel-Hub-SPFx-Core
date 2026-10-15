import * as React from 'react';

/**
 * The web part's own lightweight in-app "screens" — a full-content swap
 * within the same web part instance (chrome like GlobalNav/Footer stays),
 * not a real page navigation. TravelHub.tsx is still "a single SPFx web
 * part on one page" (ARCHITECTURE.md A40); this only changes what that one
 * web part renders, driven by a `thView` query param so the URL is
 * shareable/bookmarkable and the browser back button works.
 *
 * Add a new kind here (and a case in TravelHub.tsx) for each dedicated
 * screen. `policyPage` carries a `slug` since it's one adaptive template for
 * every Travel Policy page (`PolicyService.getPage`), not one kind per page.
 */
export type ThView =
  | { kind: 'hub' }
  | { kind: 'quickPulseResults' }
  | { kind: 'policyPage'; slug: string }
  | { kind: 'testimonialsAll' }
  | { kind: 'testimonialsSubmit' }
  | { kind: 'servicePage'; serviceId: number }
  | { kind: 'businessTravel' }
  | { kind: 'teamAll' }
  | { kind: 'greenTravel' }
  | { kind: 'spendDetail' }
  /** A TH_Offers details screen; `fromSlug` = the page it was opened from (breadcrumb, nav tab). */
  | { kind: 'offer'; id: number; fromSlug: string | undefined }
  /** "All News & Articles" (Travel News card's View All). */
  | { kind: 'newsAll' }
  /** One internal TH_TravelNews article. */
  | { kind: 'newsDetail'; id: number }
  /** "All Events" (Upcoming Events card's View All). */
  | { kind: 'eventsAll' }
  /** One TH_TravelEvents event. */
  | { kind: 'eventDetail'; id: number }
  /** Content Admin screen (admin group members only - AdminScreen.tsx). */
  | { kind: 'admin' };

export type ThViewKind = ThView['kind'];

export interface INavigation {
  view: ThView;
  navigate: (view: ThView) => void;
}

export const NavigationContext = React.createContext<INavigation | undefined>(undefined);

export function useNavigation(): INavigation {
  const nav = React.useContext(NavigationContext);
  if (nav === undefined) {
    throw new Error('useNavigation() must be used within <NavigationContext.Provider>. Check TravelHub.tsx.');
  }
  return nav;
}
