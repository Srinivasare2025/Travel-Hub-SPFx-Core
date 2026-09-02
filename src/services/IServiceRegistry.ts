import { ITravelHubConfiguration } from '../models';
import { IHeroBannerService } from './HeroBannerService';
import { ITravelServicesService } from './TravelServicesService';
import { INewsService } from './NewsService';
import { IEventService } from './EventService';
import { ITravelTipsService } from './TravelTipsService';
import { IGlobalNavigationService } from './GlobalNavigationService';

/**
 * The set of services + resolved configuration handed to the React tree via
 * ServiceContext. Components read from here through `useServices()`; they never
 * construct a service or touch PnPjs (ARCHITECTURE.md §6).
 *
 * Extended one entry per section as later phases land (testimonials, pulse,
 * spend, team, footer).
 */
export interface IServiceRegistry {
  configuration: ITravelHubConfiguration;
  hero: IHeroBannerService;
  travelServices: ITravelServicesService;
  news: INewsService;
  events: IEventService;
  tips: ITravelTipsService;
  globalNav: IGlobalNavigationService;
}
