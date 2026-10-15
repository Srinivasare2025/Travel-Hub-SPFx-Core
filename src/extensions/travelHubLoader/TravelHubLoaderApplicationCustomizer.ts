import { BaseApplicationCustomizer } from '@microsoft/sp-application-base';
// Pure modules with no imports of their own - this bundle stays tiny.
import {
  setHostChromeEnabled,
  currentPagePath,
  isRememberedHostingPage,
  forgetHostingPage
} from '../../webparts/travelHub/hostChromeCss';
import { renderSplash } from '../../webparts/travelHub/splash';

/**
 * Properties set when the extension is registered on the site
 * (provisioning/travelhub-register-loader.js, or PnP PowerShell
 * `Add-PnPApplicationCustomizer -ClientSideComponentProperties`).
 */
export interface ITravelHubLoaderProperties {
  /**
   * Pages that host the Travel Hub web part, as page file names or
   * server-relative URL endings, e.g. `["Home.aspx", "TravelHub.aspx"]`
   * (case-insensitive). Empty / not set = only the pages this browser has
   * already seen the Travel Hub web part render on (hostChromeCss.ts
   * rememberHostingPage) - never Site Contents, lists or other pages.
   */
  pages?: string[];
  /** Safety net: the cover is always removed after this many seconds (default 12). */
  maxWaitSeconds?: number;
}

const OVERLAY_ID = 'th-page-loader';
/** Fired by TravelHubWebPart once the app (or its own splash) is on screen. */
export const READY_EVENT = 'travelhub:ready';

/**
 * "Before the web part loads, the SharePoint page content shows" (business
 * report, Oct 2026). A web part's code - including its chrome-hiding CSS
 * (hostChrome.ts) - can only run once SharePoint has rendered the page canvas
 * and downloaded that web part, so for that first moment the suite bar, site
 * header, page title and other sections are visible. This happens to every
 * SPFx web part that takes over a page; it is not specific to Travel Hub.
 *
 * An Application Customizer is loaded by SharePoint as part of the page shell,
 * BEFORE the canvas and its web parts. This one, on Travel Hub pages only:
 *  1. applies the same chrome-hiding stylesheet immediately, and
 *  2. covers the viewport with the Travel Hub splash (same look as the web
 *     part's own splash, splash.ts),
 * then fades the cover away as soon as the web part reports it is on screen
 * (READY_EVENT, or its splash/app appearing in the page) - so visitors go
 * straight from the splash to the app without seeing SharePoint's page.
 * Edit mode is never touched. A timeout guarantees the page can't stay covered.
 */
export default class TravelHubLoaderApplicationCustomizer extends BaseApplicationCustomizer<ITravelHubLoaderProperties> {
  private observer: MutationObserver | undefined;
  private timer: number | undefined;

  public onInit(): Promise<void> {
    this.apply();
    // SharePoint swaps pages without a full reload inside a site.
    this.context.application.navigatedEvent.add(this, () => this.apply());
    return Promise.resolve();
  }

  protected onDispose(): void {
    this.reveal(true);
  }

  private isTravelHubPage(): boolean {
    const path = currentPagePath();
    // System and list pages never host the web part (Site Contents, Site
    // Pages library view, list forms, settings) - the old 'empty = every
    // page' default covered them with the splash and hid their chrome.
    if (/\/(_layouts|_api|lists|forms)\//.test(`${path}/`)) {
      return false;
    }
    const pages = (this.properties?.pages ?? []).map((p) => p.trim().toLowerCase()).filter((p) => p.length > 0);
    if (pages.length === 0) {
      return isRememberedHostingPage(path);
    }
    return pages.some((p) => path.endsWith(p.startsWith('/') ? p : `/${p}`) || path.endsWith(p));
  }

  private appOnScreen(): boolean {
    // The web part's splash inside the page canvas, or the mounted app.
    return document.querySelector('[data-th-shell], .CanvasZone .th-splash') !== null;
  }

  private apply(): void {
    // Re-checked on every (in-site) navigation: edit mode and the page change.
    const editMode = /[?&](Mode=Edit|env=Embedded)/i.test(window.location.search);
    if (editMode || !this.isTravelHubPage()) {
      this.reveal(true);
      setHostChromeEnabled(false);
      return;
    }
    setHostChromeEnabled(true);
    if (this.appOnScreen()) {
      return;
    }
    this.cover();
  }

  private cover(): void {
    if (document.getElementById(OVERLAY_ID) === null) {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;overflow:hidden;transition:opacity 180ms ease;opacity:1';
      renderSplash(overlay);
      document.body.appendChild(overlay);
    }

    const done = (): void => this.reveal(false);
    window.addEventListener(READY_EVENT, done, { once: true });
    if (typeof MutationObserver !== 'undefined') {
      this.observer?.disconnect();
      this.observer = new MutationObserver(() => {
        if (this.appOnScreen()) {
          done();
        }
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    }
    window.clearTimeout(this.timer);
    const seconds = Math.min(Math.max(this.properties?.maxWaitSeconds ?? 12, 3), 60);
    this.timer = window.setTimeout(() => {
      if (!this.appOnScreen()) {
        // The web part never showed up (removed from this page, or the page
        // was renamed): stop treating the page as Travel Hub and give the
        // visitor SharePoint's chrome back. The web part re-adds both if it
        // does render later.
        forgetHostingPage();
        setHostChromeEnabled(false);
      }
      done();
    }, seconds * 1000);
  }

  /** Removes the cover (fading unless `immediate`); the chrome CSS stays on Travel Hub pages. */
  private reveal(immediate: boolean): void {
    this.observer?.disconnect();
    this.observer = undefined;
    window.clearTimeout(this.timer);
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay === null) {
      return;
    }
    if (immediate) {
      overlay.remove();
      return;
    }
    overlay.style.opacity = '0';
    window.setTimeout(() => overlay.remove(), 200);
  }
}
