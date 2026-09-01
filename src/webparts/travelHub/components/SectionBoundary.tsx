import * as React from 'react';
import { ErrorState } from '../../../common/components';
import { Logger } from '../../../services/base/Logger';

const log = new Logger('TravelHub:SectionBoundary');

interface ISectionBoundaryProps {
  name: string;
  children: React.ReactNode;
}

interface ISectionBoundaryState {
  hasError: boolean;
}

/**
 * Wraps each section so a runtime error renders a friendly panel instead of
 * blanking the whole page (ARCHITECTURE.md §7).
 */
export class SectionBoundary extends React.Component<ISectionBoundaryProps, ISectionBoundaryState> {
  public state: ISectionBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ISectionBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error): void {
    log.error(`Section "${this.props.name}" failed to render`, error);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorState message="This section is temporarily unavailable." />;
    }
    return this.props.children;
  }
}
