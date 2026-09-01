import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IServiceRegistry } from './IServiceRegistry';
import { SharePointService } from './base/SharePointService';
import { MemoryCache } from './base/MemoryCache';
import { Logger } from './base/Logger';
import { ConfigurationService } from './ConfigurationService';
import { HeroBannerService } from './HeroBannerService';
import { TravelServicesService } from './TravelServicesService';
import { NewsService } from './NewsService';
import { EventService } from './EventService';
import { TravelTipsService } from './TravelTipsService';

/**
 * Composition root for the service layer. Called once from
 * `TravelHubWebPart.onInit()`. Builds one PnPjs instance, one cache, one logger,
 * resolves configuration up front, and wires every feature service.
 */
export async function createServiceRegistry(context: WebPartContext): Promise<IServiceRegistry> {
  const logger = new Logger('TravelHub');
  const cache = new MemoryCache();
  const spo = new SharePointService(context, logger);

  const configuration = await new ConfigurationService(spo, cache, logger).getConfiguration();

  return {
    configuration,
    hero: new HeroBannerService(spo, cache, logger),
    travelServices: new TravelServicesService(spo, cache, logger),
    news: new NewsService(spo, cache, logger),
    events: new EventService(spo, cache, logger),
    tips: new TravelTipsService(spo, cache, logger)
  };
}
