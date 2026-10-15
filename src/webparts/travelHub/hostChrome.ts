/**
 * Host-page chrome, hidden the moment SharePoint evaluates the web part's
 * entry bundle - BEFORE React, Fluent, PnPjs and the app chunk download.
 *
 * Reported issue: "the SharePoint page shows first, then the web part".
 * SharePoint only runs a web part's code after its entry bundle downloads.
 * The entry used to hold the whole app, and the chrome-hiding CSS
 * (chromeOverride.ts) only ran once React had mounted - so visitors watched
 * the suite bar, site header, page title, breadcrumb, comments and footer for
 * the entire download. Now TravelHubWebPart.ts imports this file FIRST from a
 * deliberately tiny entry bundle (the app is a separate lazy chunk, see
 * mount.tsx), so everything below is hidden almost immediately. Same fix as
 * the sibling fa-portal solution's src/styles/globalChrome.ts and HR-Hub-SPFx's
 * immersiveChrome.ts.
 *
 * Hidden in VIEW mode only - a page author still needs SharePoint's chrome
 * to edit and publish (EDIT_MODE below, and TravelHubWebPart calls
 * setHostChromeEnabled(false) whenever SPFx reports DisplayMode.Edit).
 *
 *  - The Microsoft 365 suite bar (`#SuiteNavWrapper`), app bar, site header,
 *    command bar, page-title banner, hub-site navigation / breadcrumb, page
 *    comments, social bar and site footer - stable ids / automation ids.
 *  - Every OTHER canvas section on the page (a text web part, the in-canvas
 *    title, …): TravelHubWebPart tags the canvas zone hosting the app with
 *    `data-th-zone` on its first render; until that tag exists nothing is
 *    hidden, so a page without the web part is never affected.
 *  - The host page is painted in the app's canvas colour (`--th-host-canvas`,
 *    set by TravelHub.tsx; Sky until React mounts) so no white band shows
 *    around the app.
 *
 * NO imports on purpose: anything imported here lands in the entry bundle and
 * delays this. `!important` is required throughout - SharePoint injects its
 * own rules of equal specificity after this tag. chromeOverride.ts still owns
 * the `layout.fullBleed` canvas-gutter neutralisation once the app has loaded.
 */
import { EDIT_MODE, setHostChromeEnabled } from './hostChromeCss';

export { setHostChromeEnabled };

setHostChromeEnabled(!EDIT_MODE);
