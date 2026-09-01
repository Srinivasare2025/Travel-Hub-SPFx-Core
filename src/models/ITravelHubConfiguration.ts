import { SectionKey } from './common';
import { IHeroQuickLink } from './IHeroBanner';

export interface IResponsiveCounts {
  desktopVisibleCards: number;
  tabletVisibleCards: number;
  mobileVisibleCards: number;
}

export interface IViewAll {
  text: string;
  /** Validated; falls back to '#' when invalid. */
  url: string;
}

export interface ISectionSetting {
  isVisible: boolean;
  title: string | undefined;
}

/**
 * The fully-resolved configuration object. Produced once by ConfigurationService
 * (defaults overlaid with TH_SiteConfiguration rows) and passed down as data.
 * Components read from here — they never query the config list themselves.
 */
export interface ITravelHubConfiguration {
  brandName: string;

  layout: {
    /**
     * When true the web part breaks out of SharePoint's centred page canvas and
     * spans the full viewport width, and the inner content max-width is removed.
     * Best paired with a full-width section on a Communication site page (no left
     * nav). See DEPLOYMENT.md.
     */
    fullBleed: boolean;
  };

  hero: {
    autoPlay: boolean;
    intervalSeconds: number;
    supportingMessage: string;
    quickLinks: IHeroQuickLink[];
    /** `stack` = a narrow left column; `inline` = two cards side by side. */
    quickLinksLayout: 'stack' | 'inline';
  };

  services: IResponsiveCounts & { defaultLinkText: string };

  updates: {
    newsCount: number;
    eventsCount: number;
    tipsCount: number;
    viewAll: {
      news: IViewAll;
      events: IViewAll;
      tips: IViewAll;
    };
  };

  testimonials: IResponsiveCounts & {
    autoPlay: boolean;
    intervalSeconds: number;
    personInfoTemplate: string;
    viewAll: IViewAll;
  };

  quickPulse: {
    showAggregateResults: boolean;
    confirmationMessage: string;
    pulseAdminGroup: string;
  };

  spend: {
    viewerGroup: string;
    source: 'sharepoint' | 'powerbi' | 'concur' | 'api' | 'warehouse';
    dashboardUrl: string;
    deniedMessage: string;
  };

  team: {
    landingPageCount: number;
    viewAll: IViewAll;
  };

  footer: {
    showQrCode: boolean;
    qrCodeUrl: string;
    legalText: string;
    lastUpdatedText: string;
  };

  dates: {
    locale: string;
    showHijri: boolean;
    hijriLocale: string;
  };

  sections: Record<SectionKey, ISectionSetting>;

  featureFlags: Record<string, boolean>;
}
