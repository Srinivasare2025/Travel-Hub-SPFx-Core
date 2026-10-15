/**
 * Side-effect-free half of hostChrome.ts: the chrome-hiding stylesheet and
 * its toggle, shared by the web part's entry bundle (hostChrome.ts) and the
 * page-load extension (extensions/travelHubLoader), which applies it even
 * earlier on Travel Hub pages. See hostChrome.ts for what is hidden and why.
 * NO imports on purpose (entry-bundle size).
 */
export const STYLE_ID = 'th-host-chrome';

// SharePoint appends `?Mode=Edit` (or renders embedded) while a page is being
// edited. Cheap, dependency-free check; if unsure, assume view mode.
export const EDIT_MODE = typeof window !== 'undefined' && /[?&](Mode=Edit|env=Embedded)/i.test(window.location.search);

export const HOST_CHROME_CSS = `
#SuiteNavWrapper,
#SuiteNavPlaceHolder,
#sp-appBar,
#spAppBar,
#spSiteHeader,
#spCommandBar,
[data-automation-id="SiteHeader"],
[data-automation-id="pageHeader"],
.commandBarButtonHeightAndColor,
.ms-HubNav,
#HubNav,
[data-automation-id="HubNav"],
[data-automation-id="breadcrumb"],
[data-automation-id="pageCommandBar"],
#CommentsWrapper,
[data-automation-id="sp-socialbar"],
#spSiteFooter,
[data-automation-id="pageFooter"],
[data-automationid="SimpleFooter"],
[data-viewport-id^="Page.SiteFooter"],
[id^="vpc_Page.SiteFooter"] {
  display: none !important;
}

body:has([data-th-zone]) .CanvasZone:not([data-th-zone]) {
  display: none !important;
}

/* Full width while the splash is showing. chromeOverride.ts neutralises the
   canvas zone/section padding and max-width only once React has mounted, so
   the pre-React splash used to render inside SharePoint's narrow, padded
   content column and then jump to full width. The same resets apply here as
   soon as the splash is in the page (scoped to it with :has, so a page
   without Travel Hub is untouched). */
#spPageChromeAppDiv:has(.th-splash),
#spPageCanvasContent:has(.th-splash),
.CanvasZone:has(.th-splash),
.CanvasSection:has(.th-splash),
.CanvasZoneSectionContainer:has(.th-splash),
.ControlZone:has(.th-splash) {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  max-width: none !important;
  width: 100% !important;
}

/* The command bar's wrapper keeps a reserved top margin even once the bar is
   hidden. Obfuscated SharePoint class (same capture as fa-portal's
   globalChrome.ts) - may need re-capturing after a SharePoint update if a gap
   reappears above the app. */
.r_Ab1x8_y298L:not(.f_i54d6_y298L):not(.f_SHsQP_y298L) {
  margin-top: 0 !important;
}

html,
body,
#spPageChromeAppDiv,
#spPageCanvasContent,
[data-automation-id="contentScrollRegion"] {
  background: var(--th-host-canvas, #dff0f6) !important;
}
`;

/*
 * Pages known to host the Travel Hub web part. The web part records its page
 * here whenever it renders in view mode; the page-load extension
 * (extensions/travelHubLoader) only hides chrome / shows its splash on these
 * pages, so Site Contents, list views and every other page of the site are
 * never touched - without anyone having to configure a page list. Per
 * browser (localStorage); a first-ever visit simply shows the normal load.
 */
const HOSTING_PAGES_KEY = 'th-hosting-pages';
const MAX_REMEMBERED_PAGES = 50;

/** Lower-cased path without a trailing slash: "/sites/travelhub/sitepages/home.aspx". */
export function currentPagePath(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  let path = window.location.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep the raw path */
  }
  return path.toLowerCase().replace(/\/+$/, '');
}

function readHostingPages(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HOSTING_PAGES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function writeHostingPages(pages: string[]): void {
  try {
    window.localStorage.setItem(HOSTING_PAGES_KEY, JSON.stringify(pages.slice(-MAX_REMEMBERED_PAGES)));
  } catch {
    /* storage blocked - the extension just won't pre-hide on this browser */
  }
}

export function isRememberedHostingPage(path: string = currentPagePath()): boolean {
  return path.length > 0 && readHostingPages().indexOf(path) >= 0;
}

export function rememberHostingPage(path: string = currentPagePath()): void {
  const pages = readHostingPages();
  if (path.length > 0 && pages.indexOf(path) < 0) {
    pages.push(path);
    writeHostingPages(pages);
  }
}

export function forgetHostingPage(path: string = currentPagePath()): void {
  const pages = readHostingPages();
  const at = pages.indexOf(path);
  if (at >= 0) {
    pages.splice(at, 1);
    writeHostingPages(pages);
  }
}

/** Add (view mode) or remove (edit mode) the host-chrome stylesheet. Idempotent. */
export function setHostChromeEnabled(enabled: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  const existing = document.getElementById(STYLE_ID);
  if (!enabled) {
    if (existing !== null) {
      existing.remove();
    }
    return;
  }
  if (existing !== null) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HOST_CHROME_CSS;
  document.head.appendChild(style);
}

