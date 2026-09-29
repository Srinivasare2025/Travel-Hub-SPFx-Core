import { Version, DisplayMode } from '@microsoft/sp-core-library';
import { type IPropertyPaneConfiguration, PropertyPaneLabel } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import type { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'TravelHubWebPartStrings';
// Side-effect import, FIRST: hides SharePoint's page chrome (suite bar, site
// header, page title, breadcrumb/hub nav, comments, footer, other sections)
// as soon as SharePoint evaluates this bundle. It has no imports of its own.
import { setHostChromeEnabled } from './hostChrome';
import { renderSplash, renderLoadError } from './splash';
import type { IServiceRegistry } from '../../services/IServiceRegistry';

export interface ITravelHubWebPartProps {
  // Instance-level (page-author) settings only. Content and behaviour live in the
  // TH_SiteConfiguration list (CONFIGURATION.md), not here.
}

type AppModule = typeof import('./mount');

/**
 * SPFx entry point - composition-root wiring only.
 *
 * LOAD PERFORMANCE (reported: "the SharePoint page shows first, then the web
 * part appears after a delay"): SharePoint only runs a web part's code once
 * its entry bundle has downloaded. Previously that entry held React, Fluent,
 * PnPjs and the whole app, and the chrome-hiding CSS ran only after React
 * mounted - so visitors watched the SharePoint page for the whole download.
 * Now the entry is tiny: it hides the chrome and paints a branded splash
 * immediately, and the app itself (mount.tsx -> TravelHub) is a separate
 * chunk whose download starts in onInit, in parallel with SharePoint's own
 * initialisation. Same approach as the sibling fa-portal solution.
 *
 * Do not import React, components or services (other than `import type`)
 * here - anything imported lands back in the entry bundle.
 */
export default class TravelHubWebPart extends BaseClientSideWebPart<ITravelHubWebPartProps> {
  private _app: AppModule | undefined;
  private _registry: IServiceRegistry | undefined;
  private _initFailed = false;
  private _startup: Promise<void> | undefined;
  private _awaitingStartup = false;

  protected onInit(): Promise<void> {
    // Start downloading the app chunk + building the service layer now,
    // without blocking SharePoint: render() paints the splash meanwhile.
    this.start().catch(() => undefined);
    return super.onInit();
  }

  public render(): void {
    setHostChromeEnabled(this.displayMode !== DisplayMode.Edit);
    this.tagHostZone();

    if (this._app !== undefined && this._registry !== undefined) {
      this._app.mountApp(this.domElement, {
        services: this._registry,
        hasTeamsContext: this.context.sdks.microsoftTeams !== undefined,
        currentUser: {
          displayName: this.context.pageContext.user.displayName ?? '',
          email: this.context.pageContext.user.email ?? ''
        }
      });
      return;
    }

    if (this._initFailed) {
      renderLoadError(this.domElement);
      return;
    }

    renderSplash(this.domElement);
    if (!this._awaitingStartup) {
      this._awaitingStartup = true;
      this.start().then(
        () => {
          this._awaitingStartup = false;
          this.render();
        },
        (err: unknown) => {
          this._awaitingStartup = false;
          // eslint-disable-next-line no-console
          console.error('[TravelHub] Failed to load the app bundle', err);
          this._initFailed = true;
          this.render();
        }
      );
    }
  }

  protected onDisplayModeChanged(oldDisplayMode: DisplayMode): void {
    setHostChromeEnabled(this.displayMode !== DisplayMode.Edit);
    super.onDisplayModeChanged(oldDisplayMode);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (currentTheme === undefined) {
      return;
    }
    const { semanticColors } = currentTheme;
    if (semanticColors !== undefined) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }
  }

  protected onDispose(): void {
    if (this._app !== undefined) {
      this._app.unmountApp(this.domElement);
    }
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  /** Downloads the app chunk and builds the service registry, once. */
  private start(): Promise<void> {
    if (this._startup === undefined) {
      this._startup = import(/* webpackChunkName: 'travel-hub-app' */ './mount').then(async (app) => {
        this._app = app;
        this._registry = await app.initialiseServices(this.context);
        if (this._registry === undefined) {
          this._initFailed = true;
        }
      });
      // Allow a retry on the next render if the chunk download itself failed.
      this._startup.catch(() => {
        this._startup = undefined;
      });
    }
    return this._startup;
  }

  /**
   * Mark the canvas section hosting the app so hostChrome.ts can hide every
   * OTHER section of the page (view mode only) - walking up from the web
   * part's own element so it doesn't depend on section order or hashed class
   * names (HR Hub immersiveChrome.ts / fa-portal approach).
   */
  private tagHostZone(): void {
    let node: HTMLElement | null = this.domElement;
    while (node !== null) {
      if (node.classList !== undefined && node.classList.contains('CanvasZone')) {
        node.setAttribute('data-th-zone', '');
        return;
      }
      node = node.parentElement;
    }
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneLabel('info', {
                  text: strings.ConfigManagedInList
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
