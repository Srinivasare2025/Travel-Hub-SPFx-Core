import { IServiceRegistry } from '../../../services/IServiceRegistry';

export interface ITravelHubProps {
  /** Service layer + resolved configuration, built once in the web part's onInit(). */
  services: IServiceRegistry;
  /** True when hosted in a Microsoft Teams tab (adjusts a few spacings). */
  hasTeamsContext: boolean;
}
