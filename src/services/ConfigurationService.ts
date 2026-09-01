/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITravelHubConfiguration, SectionKey, IViewAll } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';

const LIST = 'TH_SiteConfiguration';
const CACHE_KEY = 'configuration';
const TTL_SECONDS = 600; // 10 minutes (CONFIGURATION.md / PERFORMANCE.md)

interface IRawConfigRow {
  Title: string;
  ConfigValue: string | null;
  ValueType: string | null;
  IsActive: boolean | null;
}

export interface IConfigurationService {
  /** Resolve the full configuration: hard-coded defaults overlaid with active list rows. */
  getConfiguration(): Promise<ITravelHubConfiguration>;
}

/**
 * Produces the single {@link ITravelHubConfiguration} object. A missing or
 * invalid row never breaks the page — the default wins and a warning is logged
 * (CONFIGURATION.md "precedence").
 */
export class ConfigurationService implements IConfigurationService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('ConfigurationService');
  }

  public async getConfiguration(): Promise<ITravelHubConfiguration> {
    return this.cache.getOrAdd(CACHE_KEY, TTL_SECONDS, async () => {
      const rows = await this.readRows();
      return this.build(rows);
    });
  }

  private async readRows(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const raw = await this.spo.getListItems<IRawConfigRow>({
        list: LIST,
        select: ['Title', 'ConfigValue', 'ValueType', 'IsActive'],
        filter: 'IsActive eq 1',
        top: 200
      });
      for (const row of raw) {
        if (row.Title !== null && row.Title !== undefined && row.ConfigValue !== null) {
          map.set(row.Title.trim(), row.ConfigValue);
        }
      }
    } catch {
      this.log.warn(`Could not read ${LIST}; using default configuration for every key.`);
    }
    return map;
  }

  private build(rows: Map<string, string>): ITravelHubConfiguration {
    const str = (key: string, fallback: string): string => {
      const v = rows.get(key);
      return v !== undefined && v.trim().length > 0 ? v.trim() : fallback;
    };
    const bool = (key: string, fallback: boolean): boolean => {
      const v = rows.get(key);
      if (v === undefined) {
        return fallback;
      }
      const t = v.trim().toLowerCase();
      if (t === 'true' || t === '1' || t === 'yes') {
        return true;
      }
      if (t === 'false' || t === '0' || t === 'no') {
        return false;
      }
      this.log.warn(`Config "${key}" is not a boolean ("${v}"); using default ${String(fallback)}.`);
      return fallback;
    };
    const num = (key: string, fallback: number, min: number, max: number): number => {
      const v = rows.get(key);
      if (v === undefined) {
        return fallback;
      }
      const n = parseFloat(v);
      if (!isFinite(n)) {
        this.log.warn(`Config "${key}" is not a number ("${v}"); using default ${String(fallback)}.`);
        return fallback;
      }
      if (n < min || n > max) {
        this.log.warn(`Config "${key}" (${String(n)}) out of range [${String(min)}, ${String(max)}]; clamping.`);
        return Math.min(Math.max(n, min), max);
      }
      return n;
    };
    const url = (key: string, fallback: string): string => {
      const v = rows.get(key);
      if (v === undefined || v.trim().length === 0) {
        return fallback;
      }
      const safe = sanitizeUrl(v);
      if (safe === undefined) {
        this.log.warn(`Config "${key}" is not a safe URL ("${v}"); using default "${fallback}".`);
        return fallback;
      }
      return safe;
    };
    const viewAll = (prefix: string, defaultText: string): IViewAll => ({
      text: str(`${prefix}.text`, defaultText),
      url: url(`${prefix}.url`, '#')
    });

    const enumVal = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
      const v = rows.get(key)?.trim().toLowerCase();
      const match = allowed.find((a) => a.toLowerCase() === v);
      if (v !== undefined && match === undefined) {
        this.log.warn(`Config "${key}" ("${v}") is not one of [${allowed.join(', ')}]; using "${fallback}".`);
      }
      return match ?? fallback;
    };

    const brandName = str('brand.name', 'RSG');

    const sectionKeys: SectionKey[] = [
      'hero',
      'travelServices',
      'travelUpdates',
      'travelerEngagement',
      'travelInsights',
      'travelTeam',
      'footer'
    ];
    const sections = sectionKeys.reduce(
      (acc, key) => {
        acc[key] = {
          isVisible: bool(`sections.${key}.isVisible`, true),
          title: rows.get(`sections.${key}.title`)?.trim()
        };
        return acc;
      },
      {} as ITravelHubConfiguration['sections']
    );

    const featureFlags: Record<string, boolean> = {
      heroVideo: bool('featureFlags.heroVideo', true),
      newsOnPremLinks: bool('featureFlags.newsOnPremLinks', true),
      rtl: bool('featureFlags.rtl', false)
    };
    rows.forEach((_value, key) => {
      if (key.startsWith('featureFlags.')) {
        const flagName = key.substring('featureFlags.'.length);
        if (featureFlags[flagName] === undefined) {
          featureFlags[flagName] = bool(key, false);
        }
      }
    });

    return {
      brandName,
      layout: {
        fullBleed: bool('layout.fullBleed', true)
      },
      hero: {
        autoPlay: bool('hero.autoPlay', true),
        intervalSeconds: num('hero.intervalSeconds', 6, 3, 20),
        supportingMessage: str('hero.supportingMessage', 'Travel Care — Your Partner in Every Journey'),
        quickLinksLayout: enumVal('hero.quickLinks.layout', ['stack', 'inline'] as const, 'inline'),
        quickLinks: [
          {
            key: 'helpDesk' as const,
            title: str('hero.quickLink.helpDesk.title', 'Travel Services Help Desk'),
            description: str(
              'hero.quickLink.helpDesk.description',
              'General travel guidance and non-urgent assistance'
            ),
            url: (() => {
              const u = url('hero.quickLink.helpDesk.url', '#');
              return u === '#' ? undefined : u;
            })(),
            kind: enumVal('hero.quickLink.helpDesk.type', ['page', 'image'] as const, 'page'),
            openInNewTab: bool('hero.quickLink.helpDesk.openInNewTab', true),
            badgeText: rows.get('hero.quickLink.helpDesk.badgeText')?.trim() || undefined
          },
          {
            key: 'travelCare' as const,
            title: str('hero.quickLink.travelCare.title', 'Travel Care 24/7'),
            description: str(
              'hero.quickLink.travelCare.description',
              'Urgent support anytime, anywhere'
            ),
            url: (() => {
              const u = url('hero.quickLink.travelCare.url', '#');
              return u === '#' ? undefined : u;
            })(),
            kind: enumVal('hero.quickLink.travelCare.type', ['page', 'image'] as const, 'image'),
            openInNewTab: bool('hero.quickLink.travelCare.openInNewTab', true),
            badgeText: str('hero.quickLink.travelCare.badgeText', '24/7') || undefined
          }
        ]
      },
      services: {
        desktopVisibleCards: num('services.desktopVisibleCards', 4, 2, 8),
        tabletVisibleCards: num('services.tabletVisibleCards', 2, 1, 4),
        mobileVisibleCards: num('services.mobileVisibleCards', 1, 1, 2),
        defaultLinkText: str('services.defaultLinkText', 'Learn More')
      },
      updates: {
        newsCount: num('updates.news.count', 4, 2, 8),
        eventsCount: num('updates.events.count', 4, 2, 8),
        tipsCount: num('updates.tips.count', 7, 3, 12),
        viewAll: {
          news: viewAll('viewAll.news', 'View All'),
          events: viewAll('viewAll.events', 'View All'),
          tips: viewAll('viewAll.tips', 'View All')
        }
      },
      testimonials: {
        autoPlay: bool('testimonials.autoPlay', true),
        intervalSeconds: num('testimonials.intervalSeconds', 8, 4, 20),
        desktopVisibleCards: num('testimonials.desktopVisibleCards', 3, 1, 4),
        tabletVisibleCards: num('testimonials.tabletVisibleCards', 2, 1, 3),
        mobileVisibleCards: num('testimonials.mobileVisibleCards', 1, 1, 2),
        personInfoTemplate: str('testimonials.personInfoTemplate', '{designation} – {location}'),
        viewAll: viewAll('viewAll.testimonials', 'View All Stories')
      },
      quickPulse: {
        showAggregateResults: bool('quickPulse.showAggregateResults', false),
        confirmationMessage: str('quickPulse.confirmationMessage', 'Thanks — your feedback has been recorded.'),
        pulseAdminGroup: str('quickPulse.pulseAdminGroup', 'TravelHub Pulse Admins')
      },
      spend: {
        viewerGroup: str('spend.viewerGroup', 'TravelHub Spend Viewers'),
        source: enumVal('spend.source', ['sharepoint', 'powerbi', 'concur', 'api', 'warehouse'] as const, 'sharepoint'),
        dashboardUrl: url('spend.dashboardUrl', '#'),
        deniedMessage: str(
          'spend.deniedMessage',
          'This dashboard is available to authorised users only. Access is role-based. Please sync with the appropriate permissions to view your department’s travel spend details.'
        )
      },
      team: {
        landingPageCount: num('team.landingPageCount', 4, 2, 8),
        viewAll: {
          text: str('team.viewAllText', 'View All Team Members'),
          url: url('team.viewAllUrl', '#')
        }
      },
      footer: {
        showQrCode: bool('footer.showQrCode', false),
        qrCodeUrl: url('footer.qrCodeUrl', '#'),
        legalText: str('footer.legalText', `© {year} {brand}. All rights reserved.`),
        lastUpdatedText: str('footer.lastUpdatedText', '')
      },
      dates: {
        locale: str('dates.locale', 'en-GB'),
        showHijri: bool('dates.showHijri', false),
        hijriLocale: str('dates.hijriLocale', 'ar-SA-u-ca-islamic-umalqura')
      },
      sections,
      featureFlags
    };
  }
}
