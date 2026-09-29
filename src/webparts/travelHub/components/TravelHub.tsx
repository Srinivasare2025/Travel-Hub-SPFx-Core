import * as React from 'react';
import type { ITravelHubProps } from './ITravelHubProps';
import { ServiceContext } from '../../../common/context/ServiceContext';
import { NavigationContext, ThView } from '../../../common/context/NavigationContext';
import {
  ShellContext,
  IShellContext,
  ThCanvas,
  CANVAS_PAGE_BG,
  readStoredCanvas,
  storeCanvas
} from '../../../common/context/ShellContext';
import { SectionBoundary } from './SectionBoundary';
import { GlobalNav } from './GlobalNav';
import { HeroBanner } from './sections/HeroBanner';
import { TravelServicesCarousel } from './sections/TravelServicesCarousel';
import { TravelUpdatesSection } from './sections/TravelUpdatesSection';
import {
  TravelerEngagementSection,
  QuickPulseResultsScreen,
  ViewAllFeedbackScreen,
  SubmitFeedbackScreen
} from './sections/TravelerEngagementSection';
import { TravelInsightsSection, GreenTravelDetailScreen, TravelSpendDetailScreen } from './sections/TravelInsightsSection';
import { TravelTeamSection, TravelTeamAllScreen } from './sections/TravelTeamSection';
import { PolicyPageScreen } from './PolicyPages';
import { ServicePageScreen } from './ServicePages';
import { BusinessTravelPageScreen } from './BusinessTravelPage';
import { TravelHubFooter } from './TravelHubFooter';
import { applyFullBleedChrome, SHELL_MARKER_ATTR } from './chromeOverride';
import styles from './TravelHub.module.scss';

// In-app "screens" (NavigationContext.ts) reflected in a query param so the
// URL stays shareable/bookmarkable and back/forward work, without this being
// a real second page - see the doc comment on ThView.
const VIEW_PARAM = 'thView';

function readViewFromLocation(): ThView {
  if (typeof window === 'undefined') {
    return { kind: 'hub' };
  }
  try {
    const raw = new URLSearchParams(window.location.search).get(VIEW_PARAM);
    if (raw === null) {
      return { kind: 'hub' };
    }
    if (raw === 'quick-pulse-results') {
      return { kind: 'quickPulseResults' };
    }
    if (raw.startsWith('policy/')) {
      const slug = raw.slice('policy/'.length).trim();
      if (slug.length > 0) {
        return { kind: 'policyPage', slug };
      }
    }
    if (raw === 'feedback-all') {
      return { kind: 'testimonialsAll' };
    }
    if (raw === 'feedback-submit') {
      return { kind: 'testimonialsSubmit' };
    }
    if (raw.startsWith('service/')) {
      const serviceId = Number(raw.slice('service/'.length));
      if (isFinite(serviceId)) {
        return { kind: 'servicePage', serviceId };
      }
    }
    if (raw === 'business-travel') {
      return { kind: 'businessTravel' };
    }
    if (raw === 'team-all') {
      return { kind: 'teamAll' };
    }
    if (raw === 'green-travel') {
      return { kind: 'greenTravel' };
    }
    if (raw === 'spend-detail') {
      return { kind: 'spendDetail' };
    }
    return { kind: 'hub' };
  } catch {
    return { kind: 'hub' };
  }
}

function viewToParam(view: ThView): string | undefined {
  switch (view.kind) {
    case 'quickPulseResults':
      return 'quick-pulse-results';
    case 'policyPage':
      return `policy/${view.slug}`;
    case 'testimonialsAll':
      return 'feedback-all';
    case 'testimonialsSubmit':
      return 'feedback-submit';
    case 'servicePage':
      return `service/${String(view.serviceId)}`;
    case 'businessTravel':
      return 'business-travel';
    case 'teamAll':
      return 'team-all';
    case 'greenTravel':
      return 'green-travel';
    case 'spendDetail':
      return 'spend-detail';
    case 'hub':
    default:
      return undefined;
  }
}

interface ITravelHubState {
  view: ThView;
  /**
   * The viewer's own canvas choice from the top bar's theme menu (persisted
   * in localStorage), or `undefined` to follow the site default
   * `configuration.theme.canvas` (TH_SiteConfiguration).
   */
  canvasOverride: ThCanvas | undefined;
}

/** Paints the SharePoint page behind the app in the active canvas (hostChrome.ts reads --th-host-canvas). */
function mirrorHostCanvas(canvas: ThCanvas): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--th-host-canvas', CANVAS_PAGE_BG[canvas]);
  }
}

/**
 * Orchestrator. Provides the service registry + in-app navigation to the
 * tree, and renders each section in the mock's order, guarded by
 * configuration-driven visibility and an error boundary. No data access, no
 * business logic, no section markup here (ARCHITECTURE.md §2).
 */
export default class TravelHub extends React.Component<ITravelHubProps, ITravelHubState> {
  public state: ITravelHubState = { view: readViewFromLocation(), canvasOverride: readStoredCanvas() };

  private get canvas(): ThCanvas {
    return this.state.canvasOverride ?? this.props.services.configuration.theme.canvas;
  }

  private readonly setCanvas = (canvas: ThCanvas): void => {
    storeCanvas(canvas);
    this.setState({ canvasOverride: canvas });
  };

  public componentDidMount(): void {
    applyFullBleedChrome(this.props.services.configuration.layout.fullBleed);
    mirrorHostCanvas(this.canvas);
    window.addEventListener('popstate', this.onPopState);
  }

  public componentDidUpdate(_prevProps: ITravelHubProps, prevState: ITravelHubState): void {
    applyFullBleedChrome(this.props.services.configuration.layout.fullBleed);
    if (prevState.canvasOverride !== this.state.canvasOverride) {
      mirrorHostCanvas(this.canvas);
    }
    if (prevState.view !== this.state.view) {
      window.scrollTo({ top: 0 });
    }
  }

  public componentWillUnmount(): void {
    applyFullBleedChrome(false);
    window.removeEventListener('popstate', this.onPopState);
  }

  private readonly onPopState = (): void => {
    this.setState({ view: readViewFromLocation() });
  };

  private readonly navigate = (view: ThView): void => {
    this.setState({ view });
    try {
      const url = new URL(window.location.href);
      const param = viewToParam(view);
      if (param === undefined) {
        url.searchParams.delete(VIEW_PARAM);
      } else {
        url.searchParams.set(VIEW_PARAM, param);
      }
      window.history.pushState({}, '', url.toString());
    } catch {
      /* URL/history unavailable (e.g. a test harness) - the view still changes, just not the address bar. */
    }
  };

  public render(): React.ReactElement<ITravelHubProps> {
    const { services, hasTeamsContext, currentUser } = this.props;
    const { configuration } = services;
    const sections = configuration.sections;
    const { view } = this.state;
    const canvas = this.canvas;
    const shell: IShellContext = { canvas, setCanvas: this.setCanvas, user: currentUser };

    return (
      <ServiceContext.Provider value={services}>
        <ShellContext.Provider value={shell}>
        <NavigationContext.Provider value={{ view, navigate: this.navigate }}>
          <div
            className={`${styles.travelHub} ${hasTeamsContext ? styles.teams : ''} ${
              configuration.layout.fullBleed ? styles.fullBleed : ''
            }`}
            dir={configuration.featureFlags.rtl ? 'rtl' : undefined}
            data-th-canvas={canvas}
            {...{ [SHELL_MARKER_ATTR]: true }}
          >
            <SectionBoundary name="GlobalNav">
              <GlobalNav />
            </SectionBoundary>

            {view.kind === 'hub' && (
              <div className={styles.page}>
                {sections.hero.isVisible && (
                  <SectionBoundary name="HeroBanner">
                    <HeroBanner />
                  </SectionBoundary>
                )}

                {sections.travelServices.isVisible && (
                  <SectionBoundary name="TravelServicesCarousel">
                    <TravelServicesCarousel
                      title={sections.travelServices.title ?? 'Explore Our Travel Services'}
                    />
                  </SectionBoundary>
                )}

                {sections.travelUpdates.isVisible && (
                  <SectionBoundary name="TravelUpdatesSection">
                    <TravelUpdatesSection
                      title={sections.travelUpdates.title ?? 'Travel Updates & Insights'}
                    />
                  </SectionBoundary>
                )}

                {sections.travelerEngagement.isVisible && (
                  <SectionBoundary name="TravelerEngagementSection">
                    <TravelerEngagementSection
                      title={sections.travelerEngagement.title ?? 'Quick Pulse'}
                    />
                  </SectionBoundary>
                )}

                {sections.travelInsights.isVisible && (
                  <SectionBoundary name="TravelInsightsSection">
                    <TravelInsightsSection title={sections.travelInsights.title ?? 'Travel Insights'} />
                  </SectionBoundary>
                )}

                {sections.travelTeam.isVisible && (
                  <SectionBoundary name="TravelTeamSection">
                    <TravelTeamSection title={sections.travelTeam.title ?? 'Meet the Travel Team'} />
                  </SectionBoundary>
                )}
              </div>
            )}

            {view.kind === 'quickPulseResults' && (
              <div className={styles.page}>
                <SectionBoundary name="QuickPulseResultsScreen">
                  <QuickPulseResultsScreen />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'policyPage' && (
              <div className={styles.page}>
                <SectionBoundary name="PolicyPageScreen">
                  <PolicyPageScreen slug={view.slug} />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'testimonialsAll' && (
              <div className={styles.page}>
                <SectionBoundary name="ViewAllFeedbackScreen">
                  <ViewAllFeedbackScreen />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'testimonialsSubmit' && (
              <div className={styles.page}>
                <SectionBoundary name="SubmitFeedbackScreen">
                  <SubmitFeedbackScreen />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'servicePage' && (
              <div className={styles.page}>
                <SectionBoundary name="ServicePageScreen">
                  <ServicePageScreen serviceId={view.serviceId} />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'businessTravel' && (
              <div className={styles.page}>
                <SectionBoundary name="BusinessTravelPageScreen">
                  <BusinessTravelPageScreen />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'teamAll' && (
              <div className={styles.page}>
                <SectionBoundary name="TravelTeamAllScreen">
                  <TravelTeamAllScreen />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'greenTravel' && (
              <div className={styles.page}>
                <SectionBoundary name="GreenTravelDetailScreen">
                  <GreenTravelDetailScreen />
                </SectionBoundary>
              </div>
            )}

            {view.kind === 'spendDetail' && (
              <div className={styles.page}>
                <SectionBoundary name="TravelSpendDetailScreen">
                  <TravelSpendDetailScreen />
                </SectionBoundary>
              </div>
            )}

            {sections.footer.isVisible && (
              <SectionBoundary name="TravelHubFooter">
                <TravelHubFooter />
              </SectionBoundary>
            )}
          </div>
        </NavigationContext.Provider>
        </ShellContext.Provider>
      </ServiceContext.Provider>
    );
  }
}
