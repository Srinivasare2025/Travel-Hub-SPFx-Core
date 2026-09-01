import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../../common/hooks';
import {
  Card,
  SectionHeader,
  LoadingState,
  EmptyState,
  ErrorState,
  ImageWithFallback,
  ExternalLink,
  Badge
} from '../../../../../common/components';
import { ITravelEvent } from '../../../../../models';
import { formatDateBlock, formatHijriDate, toIsoDate } from '../../../../../common/utils/dateFormatting';
import styles from './TravelUpdatesSection.module.scss';

/** Upcoming Events: date-block rows with title, category, time, location, image. */
export const UpcomingEventsCard: React.FC = () => {
  const { events, configuration } = useServices();
  const { status, data, retry } = useAsyncData(
    () => events.getUpcomingEvents(configuration),
    [configuration]
  );

  const df = configuration.dates;
  const viewAll = configuration.updates.viewAll.events;

  return (
    <Card as="article" padding="lg" className={styles.column}>
      <SectionHeader title="Upcoming Events" headingLevel={3} viewAll={{ ...viewAll, openInNewTab: true }} />

      {status === 'loading' && <LoadingState variant="rows" count={4} label="Loading upcoming events" />}
      {status === 'empty' && <EmptyState message="There are no upcoming events right now." iconName="Calendar" />}
      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && data !== undefined && (
        <ul className={styles.eventList}>
          {data.map((event) => (
            <EventRow key={event.id} event={event} df={df} />
          ))}
        </ul>
      )}
    </Card>
  );
};

function EventRow({
  event,
  df
}: {
  event: ITravelEvent;
  df: { locale: string; showHijri: boolean; hijriLocale: string };
}): React.ReactElement {
  const block = formatDateBlock(event.eventDate, df);
  const hijri = formatHijriDate(event.eventDate, df);
  const timeText = [event.startTime, event.endTime].filter((t) => t !== undefined).join(' – ');

  return (
    <li className={styles.eventRow}>
      <div className={styles.dateBlock} aria-hidden="true">
        <span className={styles.dateDay}>{block.day}</span>
        <span className={styles.dateMonth}>{block.month}</span>
      </div>

      <div className={styles.eventBody}>
        {event.category !== undefined && <Badge text={event.category} tone="navy" />}
        <h4 className={styles.eventTitle}>
          <time dateTime={toIsoDate(event.eventDate)} className={styles.srOnly}>
            {block.day} {block.month}
          </time>
          {event.registrationUrl !== undefined ? (
            <ExternalLink href={event.registrationUrl} openInNewTab ariaLabel={`${event.title} — register`}>
              {event.title}
            </ExternalLink>
          ) : (
            event.title
          )}
        </h4>
        {event.description.length > 0 && <p className={styles.eventText}>{event.description}</p>}
        <div className={styles.eventMeta}>
          {timeText.length > 0 && (
            <span>
              <Icon iconName="Clock" aria-hidden="true" /> {timeText}
            </span>
          )}
          {event.location !== undefined && (
            <span>
              <Icon iconName="POI" aria-hidden="true" /> {event.location}
            </span>
          )}
          {hijri.length > 0 && <span className={styles.hijri}>{hijri}</span>}
        </div>
      </div>

      {event.imageUrl !== undefined && (
        <ImageWithFallback src={event.imageUrl} alt="" aspectRatio="1 / 1" className={styles.eventThumb} />
      )}
    </li>
  );
}
