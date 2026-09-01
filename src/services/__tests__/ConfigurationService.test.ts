/* eslint-disable no-script-url -- deliberately tests that a javascript: config value is rejected. */
// @microsoft/sp-core-library is stubbed via config/jest.config.json moduleNameMapper
// (the real module pulls internal-only deps that don't resolve under Jest).
import { ConfigurationService } from '../ConfigurationService';
import { MemoryCache } from '../base/MemoryCache';
import { Logger } from '../base/Logger';
import type { SharePointService } from '../base/SharePointService';

interface IRow {
  Title: string;
  ConfigValue: string;
  ValueType: string;
  IsActive: boolean;
}

function fakeSpo(rows: IRow[]): SharePointService {
  return {
    getListItems: async () => rows
  } as unknown as SharePointService;
}

const logger = new Logger('test');

describe('ConfigurationService', () => {
  it('returns valid defaults when the list is empty', async () => {
    const svc = new ConfigurationService(fakeSpo([]), new MemoryCache(), logger);
    const config = await svc.getConfiguration();

    expect(config.brandName).toBe('RSG');
    expect(config.hero.autoPlay).toBe(true);
    expect(config.hero.intervalSeconds).toBe(6);
    expect(config.services.desktopVisibleCards).toBe(4);
    expect(config.sections.hero.isVisible).toBe(true);
    expect(config.dates.locale).toBe('en-GB');
  });

  it('overlays active rows onto the defaults', async () => {
    const svc = new ConfigurationService(
      fakeSpo([
        { Title: 'brand.name', ConfigValue: 'Contoso Travel', ValueType: 'string', IsActive: true },
        { Title: 'services.desktopVisibleCards', ConfigValue: '6', ValueType: 'number', IsActive: true },
        { Title: 'sections.footer.isVisible', ConfigValue: 'false', ValueType: 'boolean', IsActive: true }
      ]),
      new MemoryCache(),
      logger
    );
    const config = await svc.getConfiguration();

    expect(config.brandName).toBe('Contoso Travel');
    expect(config.services.desktopVisibleCards).toBe(6);
    expect(config.sections.footer.isVisible).toBe(false);
  });

  it('falls back to the default for an invalid value and clamps out-of-range numbers', async () => {
    const svc = new ConfigurationService(
      fakeSpo([
        { Title: 'hero.autoPlay', ConfigValue: 'banana', ValueType: 'boolean', IsActive: true },
        { Title: 'services.desktopVisibleCards', ConfigValue: '999', ValueType: 'number', IsActive: true },
        { Title: 'hero.quickLink.helpDesk.url', ConfigValue: 'javascript:alert(1)', ValueType: 'string', IsActive: true }
      ]),
      new MemoryCache(),
      logger
    );
    const config = await svc.getConfiguration();

    expect(config.hero.autoPlay).toBe(true); // default
    expect(config.services.desktopVisibleCards).toBe(8); // clamped to max
    expect(config.hero.quickLinks[0].url).toBeUndefined(); // unsafe URL rejected
  });

  it('still resolves when the list read throws', async () => {
    const throwingSpo = {
      getListItems: async () => {
        throw new Error('403');
      }
    } as unknown as SharePointService;

    const config = await new ConfigurationService(throwingSpo, new MemoryCache(), logger).getConfiguration();
    expect(config.brandName).toBe('RSG');
  });
});
