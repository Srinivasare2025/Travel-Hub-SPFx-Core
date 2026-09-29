import { IServiceRegistry } from '../../../services/IServiceRegistry';
import { IShellUser } from '../../../common/context/ShellContext';

export interface ITravelHubProps {
  /** Service layer + resolved configuration, built once in the web part's onInit(). */
  services: IServiceRegistry;
  /** True when hosted in a Microsoft Teams tab (adjusts a few spacings). */
  hasTeamsContext: boolean;
  /** Signed-in user from the SPFx page context (top bar profile menu). */
  currentUser: IShellUser;
}
