import { ITravelHubConfiguration } from '../models';
import { IHeroBannerService } from './HeroBannerService';
import { ITravelServicesService } from './TravelServicesService';
import { INewsService } from './NewsService';
import { IEventService } from './EventService';
import { ITravelTipsService } from './TravelTipsService';
import { IGlobalNavigationService } from './GlobalNavigationService';
import { IQuickPulseService } from './QuickPulseService';
import { ITestimonialsService } from './TestimonialsService';
import { ITravelSpendService } from './TravelSpendService';
import { IGreenTravelService } from './GreenTravelService';
import { ITravelTeamService } from './TravelTeamService';
import { IFooterService } from './FooterService';
import { IPolicyService } from './PolicyService';
import { IBusinessTravelService } from './BusinessTravelService';

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
  quickPulse: IQuickPulseService;
  testimonials: ITestimonialsService;
  spend: ITravelSpendService;
  greenTravel: IGreenTravelService;
  team: ITravelTeamService;
  footer: IFooterService;
  policy: IPolicyService;
  businessTravel: IBusinessTravelService;
}
