import * as React from 'react';
import type { ITravelHubProps } from './ITravelHubProps';
import { ServiceContext } from '../../../common/context/ServiceContext';
import { SectionBoundary } from './SectionBoundary';
import { GlobalNav } from './GlobalNav';
import { HeroBanner } from './sections/HeroBanner';
import { TravelServicesCarousel } from './sections/TravelServicesCarousel';
import { TravelUpdatesSection } from './sections/TravelUpdatesSection';
import { applyFullBleedChrome, SHELL_MARKER_ATTR } from './chromeOverride';
import styles from './TravelHub.module.scss';

/**
 * Orchestrator. Provides the service registry to the tree and renders each
 * section in the mock's order, guarded by configuration-driven visibility and an
 * error boundary. No data access, no business logic, no section markup here
 * (ARCHITECTURE.md §2).
 */
export default class TravelHub extends React.Component<ITravelHubProps> {
  public componentDidMount(): void {
    applyFullBleedChrome(this.props.services.configuration.layout.fullBleed);
  }

  public componentDidUpdate(): void {
    applyFullBleedChrome(this.props.services.configuration.layout.fullBleed);
  }

  public componentWillUnmount(): void {
    applyFullBleedChrome(false);
  }

  public render(): React.ReactElement<ITravelHubProps> {
    const { services, hasTeamsContext } = this.props;
    const { configuration } = services;
    const sections = configuration.sections;

    return (
      <ServiceContext.Provider value={services}>
        <div
          className={`${styles.travelHub} ${hasTeamsContext ? styles.teams : ''} ${
            configuration.layout.fullBleed ? styles.fullBleed : ''
          }`}
          dir={configuration.featureFlags.rtl ? 'rtl' : undefined}
          data-th-canvas={configuration.theme.canvas}
          {...{ [SHELL_MARKER_ATTR]: true }}
        >
          <SectionBoundary name="GlobalNav">
            <GlobalNav />
          </SectionBoundary>

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

            {/* Phases 7-10 add: TravelerEngagement, TravelInsights, TravelTeam, Footer */}
          </div>
        </div>
      </ServiceContext.Provider>
    );
  }
}
