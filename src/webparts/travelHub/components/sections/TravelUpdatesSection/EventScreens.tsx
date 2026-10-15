import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Badge, Button, EmptyState, ErrorState, ImageWithFallback, LoadingState, RichHtml } from '../../../../../common/components';
import { formatDateBlock, formatHijriDate, formatLongDate, toIsoDate } from '../../../../../common/utils/dateFormatting';
import { htmlToText } from '../../../../../common/utils/sanitizeHtml';
import type { ITravelEvent } from '../../../../../models';
import { UpdatesBreadcrumb, UpdatesFilters } from './NewsScreens';
import styles from './UpdatesScreens.module.scss';

const ALL = 'All';
type When = 'upcoming' | 'past';

function isUpcoming(event: ITravelEvent): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return event.eventDate.getTime() >= today.getTime();
}

function timeText(event: ITravelEvent): string {
  return [event.startTime, event.endTime].filter((t) => t !== undefined).join(' – ');
}

/** "09:00", "9:30 AM", "14.15" -> [hours, minutes], or undefined. */
function parseTime(raw: string | undefined): [number, number] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i.exec(raw.trim());
  if (m === null) {
    return undefined;
  }
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) {
    h += 12;
  }
  if (ampm === 'am' && h === 12) {
    h = 0;
  }
  return h < 24 && min < 60 ? [h, min] : undefined;
}

const pad = (n: number): string => (n < 10 ? `0${String(n)}` : String(n));
const icsDate = (d: Date): string => `${String(d.getFullYear())}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsDateTime = (d: Date): string =>
  `${String(d.getUTCFullYear())}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const icsText = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Downloads an .ics file so the event can be added to Outlook / any calendar. */
function downloadIcs(event: ITravelEvent): void {
  const start = parseTime(event.startTime);
  const end = parseTime(event.endTime);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Travel Hub//Events//EN', 'BEGIN:VEVENT', `UID:travelhub-event-${String(event.id)}@travelhub`];
  lines.push(`DTSTAMP:${icsDateTime(new Date())}`);
  if (start !== undefined) {
    const s = new Date(event.eventDate);
    s.setHours(start[0], start[1], 0, 0);
    const e = new Date(event.eventDate);
    if (end !== undefined) {
      e.setHours(end[0], end[1], 0, 0);
    } else {
      e.setTime(s.getTime() + 60 * 60 * 1000);
    }
    lines.push(`DTSTART:${icsDateTime(s)}`, `DTEND:${icsDateTime(e)}`);
  } else {
    const next = new Date(event.eventDate);
    next.setDate(next.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(event.eventDate)}`, `DTEND;VALUE=DATE:${icsDate(next)}`);
  }
  lines.push(`SUMMARY:${icsText(event.title)}`);
  const description = htmlToText(event.details) || event.description;
  if (description.length > 0) {
    lines.push(`DESCRIPTION:${icsText(description)}`);
  }
  if (event.location !== undefined) {
    lines.push(`LOCATION:${icsText(event.location)}`);
  }
  if (event.registrationUrl !== undefined && /^https?:/i.test(event.registrationUrl)) {
    lines.push(`URL:${event.registrationUrl}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^\w\- ]+/g, '').trim() || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventTile({ event, df }: { event: ITravelEvent; df: { locale: string; showHijri: boolean; hijriLocale: string } }): React.ReactElement {
  const { navigate } = useNavigation();
  const block = formatDateBlock(event.eventDate, df);
  const time = timeText(event);
  const past = !isUpcoming(event);
  return (
    <article className={`${styles.eventTile} ${past ? styles.eventTilePast : ''}`}>
      <div className={styles.eventTileMedia}>
        <ImageWithFallback src={event.imageUrl} alt="" aspectRatio="16 / 9" fallbackIcon="Calendar" />
        <span className={styles.eventDateBadge} aria-hidden="true">
          <span className={styles.eventDateDay}>{block.day}</span>
          <span className={styles.eventDateMonth}>{block.month}</span>
        </span>
      </div>
      <div className={styles.tileBody}>
        <div className={styles.meta}>
          {event.category !== undefined && <Badge text={event.category} tone="navy" />}
          <time dateTime={toIsoDate(event.eventDate)}>{formatLongDate(event.eventDate, df)}</time>
          {past && <span className={styles.pastLabel}>Past event</span>}
        </div>
        <h2 className={styles.tileTitle}>
          {/* Stretched over the whole tile (CSS ::after), so the card is one click target. */}
          <button type="button" className={styles.stretchedLink} onClick={() => navigate({ kind: 'eventDetail', id: event.id })}>
            {event.title}
          </button>
        </h2>
        {event.description.length > 0 && <p className={styles.tileText}>{event.description}</p>}
        <div className={styles.eventFacts}>
          {time.length > 0 && (
            <span>
              <Icon iconName="Clock" aria-hidden="true" /> {time}
            </span>
          )}
          {event.location !== undefined && (
            <span>
              <Icon iconName="POI" aria-hidden="true" /> {event.location}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** "All Events" - upcoming (soonest first) and past events, filterable and searchable. */
export const EventsAllScreen: React.FC = () => {
  const { events, configuration } = useServices();
  const { status, data, retry } = useAsyncData(() => events.getAllEvents(), []);
  const [when, setWhen] = React.useState<When>('upcoming');
  const [category, setCategory] = React.useState(ALL);
  const [query, setQuery] = React.useState('');
  const df = configuration.dates;

  const counts = React.useMemo(() => {
    const all = data ?? [];
    const up = all.filter(isUpcoming).length;
    return { upcoming: up, past: all.length - up };
  }, [data]);

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (e) =>
        (when === 'upcoming') === isUpcoming(e) &&
        (category === ALL || e.category === category) &&
        (q.length === 0 || e.title.toLowerCase().indexOf(q) >= 0 || e.description.toLowerCase().indexOf(q) >= 0 || (e.location ?? '').toLowerCase().indexOf(q) >= 0)
    );
  }, [data, when, category, query]);

  const categories = React.useMemo(() => {
    const list: string[] = [];
    (data ?? []).forEach((e) => {
      if (e.category !== undefined && list.indexOf(e.category) < 0) {
        list.push(e.category);
      }
    });
    return list.sort((a, b) => a.localeCompare(b));
  }, [data]);

  return (
    <div className={styles.screen}>
      <UpdatesBreadcrumb trail={[{ label: 'Events' }]} />
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Icon iconName="Calendar" />
        </span>
        <div>
          <h1 className={styles.title}>Events</h1>
          <p className={styles.subtitle}>Travel sessions, workshops and events - what is coming up and what has happened.</p>
        </div>
      </header>

      {status === 'loading' && <LoadingState variant="grid" count={6} label="Loading events" />}
      {status === 'error' && <ErrorState onRetry={retry} />}
      {status === 'empty' && <EmptyState message="No events have been published yet." iconName="Calendar" />}

      {status === 'success' && data !== undefined && (
        <>
          <UpdatesFilters categories={categories} category={category} onCategory={setCategory} query={query} onQuery={setQuery} searchLabel="Search events">
            <div className={styles.segmented} role="tablist" aria-label="Upcoming or past events">
              {(['upcoming', 'past'] as When[]).map((w) => (
                <button key={w} type="button" role="tab" aria-selected={when === w} className={`${styles.segment} ${when === w ? styles.segmentActive : ''}`} onClick={() => setWhen(w)}>
                  {w === 'upcoming' ? 'Upcoming' : 'Past'} <span className={styles.segmentCount}>{w === 'upcoming' ? counts.upcoming : counts.past}</span>
                </button>
              ))}
            </div>
          </UpdatesFilters>
          {items.length === 0 ? (
            <EmptyState message={when === 'upcoming' ? 'There are no upcoming events that match.' : 'There are no past events that match.'} iconName="Calendar" />
          ) : (
            <div className={styles.grid}>
              {items.map((e) => (
                <EventTile key={e.id} event={e} df={df} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/** One event - date, time, venue, image, rich details, register and add-to-calendar. */
export const EventDetailScreen: React.FC<{ id: number }> = ({ id }) => {
  const { events, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(async () => {
    const [event, all] = await Promise.all([events.getEvent(id), events.getAllEvents().catch(() => [] as ITravelEvent[])]);
    return { event, all };
  }, [id]);
  const df = configuration.dates;

  if (status === 'loading') {
    return <LoadingState variant="hero" label="Loading the event" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  const event = data?.event;
  if (event === undefined) {
    return (
      <EmptyState
        message="This event isn't available any more."
        iconName="Calendar"
        action={
          <Button variant="secondary" onClick={() => navigate({ kind: 'eventsAll' })}>
            All Events
          </Button>
        }
      />
    );
  }

  const block = formatDateBlock(event.eventDate, df);
  const hijri = formatHijriDate(event.eventDate, df);
  const time = timeText(event);
  const upcoming = isUpcoming(event);
  const hasDetails = event.details !== undefined && htmlToText(event.details).length > 0;
  const more = (data?.all ?? []).filter((e) => e.id !== event.id && isUpcoming(e)).slice(0, 3);

  return (
    <div className={styles.screen}>
      <UpdatesBreadcrumb trail={[{ label: 'Events', onClick: () => navigate({ kind: 'eventsAll' }) }, { label: event.title }]} />

      <article className={styles.eventDetail}>
        <div className={styles.eventDetailMain}>
          <header className={styles.eventDetailHeader}>
            <span className={styles.eventDateLarge} aria-hidden="true">
              <span className={styles.eventDateDay}>{block.day}</span>
              <span className={styles.eventDateMonth}>{block.month}</span>
            </span>
            <div>
              <div className={styles.meta}>
                {event.category !== undefined && <Badge text={event.category} tone="navy" />}
                {!upcoming && <span className={styles.pastLabel}>Past event</span>}
              </div>
              <h1 className={styles.articleTitle}>{event.title}</h1>
            </div>
          </header>

          {event.imageUrl !== undefined && <ImageWithFallback src={event.imageUrl} alt="" aspectRatio="16 / 9" className={styles.articleImage} eager />}

          {hasDetails ? (
            <RichHtml html={event.details} className={styles.articleBody} />
          ) : (
            event.description.length > 0 && <RichHtml html={event.description} className={styles.articleBody} />
          )}
        </div>

        <aside className={styles.eventFactsCard} aria-label="Event information">
          <dl className={styles.factList}>
            <div>
              <dt>
                <Icon iconName="Calendar" aria-hidden="true" /> Date
              </dt>
              <dd>
                <time dateTime={toIsoDate(event.eventDate)}>{formatLongDate(event.eventDate, df)}</time>
                {hijri.length > 0 && <span className={styles.hijri}>{hijri}</span>}
              </dd>
            </div>
            {time.length > 0 && (
              <div>
                <dt>
                  <Icon iconName="Clock" aria-hidden="true" /> Time
                </dt>
                <dd>{time}</dd>
              </div>
            )}
            {event.location !== undefined && (
              <div>
                <dt>
                  <Icon iconName="POI" aria-hidden="true" /> Location
                </dt>
                <dd>{event.location}</dd>
              </div>
            )}
          </dl>
          <div className={styles.factActions}>
            {upcoming && event.registrationUrl !== undefined && (
              <Button variant="primary" href={event.registrationUrl} openInNewTab iconAfter="OpenInNewWindow">
                Register
              </Button>
            )}
            {upcoming && (
              <Button variant="secondary" onClick={() => downloadIcs(event)} iconAfter="CalendarReply">
                Add to calendar
              </Button>
            )}
          </div>
        </aside>
      </article>

      {more.length > 0 && (
        <section className={styles.related} aria-label="More upcoming events">
          <div className={styles.relatedHeader}>
            <h2 className={styles.relatedTitle}>More Upcoming Events</h2>
            <Button variant="secondary" onClick={() => navigate({ kind: 'eventsAll' })} iconAfter="ChevronRight">
              View All
            </Button>
          </div>
          <div className={styles.grid}>
            {more.map((e) => (
              <EventTile key={e.id} event={e} df={df} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
