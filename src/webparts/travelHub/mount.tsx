import * as React from 'react';
import * as ReactDom from 'react-dom';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import TravelHub from './components/TravelHub';
import { ITravelHubProps } from './components/ITravelHubProps';
import { IServiceRegistry } from '../../services/IServiceRegistry';
import { createServiceRegistry } from '../../services/createServiceRegistry';
import { Logger } from '../../services/base/Logger';

/**
 * The lazily-loaded app chunk: React, Fluent, PnPjs, the service layer and the
 * whole component tree live here, so the web part's ENTRY bundle carries none
 * of them - it only hides SharePoint's chrome and paints the splash
 * (TravelHubWebPart.ts, hostChrome.ts, splash.ts). Its download starts in
 * TravelHubWebPart.onInit, in parallel with SharePoint's own initialisation.
 */

const log = new Logger('TravelHub:WebPart');

/** Build the service registry (resolves configuration up front). `undefined` when it fails. */
export async function initialiseServices(context: WebPartContext): Promise<IServiceRegistry | undefined> {
  try {
    return await createServiceRegistry(context);
  } catch (error) {
    log.error('Failed to initialise the TravelHub service layer', error);
    return undefined;
  }
}

/** Render (or re-render) the app. ReactDom.render replaces the splash markup. */
export function mountApp(el: HTMLElement, props: ITravelHubProps): void {
  ReactDom.render(React.createElement(TravelHub, props), el);
}

export function unmountApp(el: HTMLElement): void {
  ReactDom.unmountComponentAtNode(el);
}
