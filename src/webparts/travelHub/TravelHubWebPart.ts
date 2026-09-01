import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { type IPropertyPaneConfiguration, PropertyPaneLabel } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'TravelHubWebPartStrings';
import TravelHub from './components/TravelHub';
import { ITravelHubProps } from './components/ITravelHubProps';
import { IServiceRegistry } from '../../services/IServiceRegistry';
import { createServiceRegistry } from '../../services/createServiceRegistry';
import { Logger } from '../../services/base/Logger';

export interface ITravelHubWebPartProps {
  // Instance-level (page-author) settings only. Content and behaviour live in the
  // TH_SiteConfiguration list (CONFIGURATION.md), not here.
}

const log = new Logger('TravelHub:WebPart');

export default class TravelHubWebPart extends BaseClientSideWebPart<ITravelHubWebPartProps> {
  private _registry: IServiceRegistry | undefined;
  private _initFailed = false;

  protected async onInit(): Promise<void> {
    await super.onInit();
    try {
      this._registry = await createServiceRegistry(this.context);
    } catch (error) {
      this._initFailed = true;
      log.error('Failed to initialise the TravelHub service layer', error);
    }
  }

  public render(): void {
    if (this._registry === undefined) {
      this.domElement.innerHTML = this._initFailed
        ? `<div style="padding:24px;font-family:'Segoe UI',sans-serif;color:#7b8794">TravelHub could not start. Please refresh the page or contact your administrator.</div>`
        : `<div style="padding:24px;font-family:'Segoe UI',sans-serif;color:#7b8794">Loading TravelHub…</div>`;
      return;
    }

    const element: React.ReactElement<ITravelHubProps> = React.createElement(TravelHub, {
      services: this._registry,
      hasTeamsContext: this.context.sdks.microsoftTeams !== undefined
    });

    ReactDom.render(element, this.domElement);
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
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
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
