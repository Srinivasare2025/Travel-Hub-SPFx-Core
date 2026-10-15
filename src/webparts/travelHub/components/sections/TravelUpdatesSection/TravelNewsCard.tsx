import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
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
import { ITravelNews } from '../../../../../models';
import { formatLongDate, toIsoDate } from '../../../../../common/utils/dateFormatting';
import styles from './TravelUpdatesSection.module.scss';

/** Travel News & Articles: a featured lead item + a list of further items. */
export const TravelNewsCard: React.FC = () => {
  const { news, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => news.getNews(configuration), [configuration]);

  const df = configuration.dates;
  const viewAll = configuration.updates.viewAll.news;
  const title = 'Travel News & Articles';

  return (
    <Card as="article" padding="lg" className={styles.column}>
      {/* View All opens the in-app "All News & Articles" screen (was: the
          configured URL in a new tab, which by default was this same page). */}
      <SectionHeader title={title} headingLevel={3} viewAll={{ text: viewAll.text, onClick: () => navigate({ kind: 'newsAll' }) }} />

      {status === 'loading' && <LoadingState variant="list" count={3} label={`Loading ${title}`} />}
      {status === 'empty' && <EmptyState message="No articles have been published yet." iconName="News" />}
      {status === 'error' && <ErrorState onRetry={retry} />}

      {status === 'success' && data !== undefined && (
        <div className={styles.newsList}>
          {data.map((item, index) =>
            index === 0 ? (
              <FeaturedNews key={item.id} item={item} dateLabel={formatLongDate(item.publishDate, df)} />
            ) : (
              <NewsRow key={item.id} item={item} dateLabel={formatLongDate(item.publishDate, df)} />
            )
          )}
        </div>
      )}
    </Card>
  );
};

function OnPremHint(): React.ReactElement {
  return (
    <span className={styles.onPrem} title="Opens the legacy SharePoint site">
      <Icon iconName="NavigateExternalInline" aria-hidden="true" /> legacy site
    </span>
  );
}

/**
 * Where a news item goes: an External / legacy link opens its own page in a
 * new tab; internal content opens the in-app article screen.
 */
export const NewsLink: React.FC<{ item: ITravelNews; className?: string; ariaLabel?: string; showArrow?: boolean; children: React.ReactNode }> = ({
  item,
  className,
  ariaLabel,
  showArrow = false,
  children
}) => {
  const { navigate } = useNavigation();
  if (item.opensExternally) {
    return (
      <ExternalLink href={item.targetUrl} openInNewTab className={className} ariaLabel={ariaLabel} showArrow={showArrow}>
        {children}
      </ExternalLink>
    );
  }
  return (
    <ExternalLink href={undefined} onClick={() => navigate({ kind: 'newsDetail', id: item.id })} className={className} ariaLabel={ariaLabel} showArrow={showArrow}>
      {children}
    </ExternalLink>
  );
};

function FeaturedNews({ item, dateLabel }: { item: ITravelNews; dateLabel: string }): React.ReactElement {
  return (
    <article className={styles.featured}>
      <ImageWithFallback src={item.imageUrl} alt="" aspectRatio="16 / 9" className={styles.featuredImage} />
      <div className={styles.featuredBody}>
        <div className={styles.metaRow}>
          {item.category !== undefined && <Badge text={item.category} tone="gold" />}
          <time dateTime={toIsoDate(item.publishDate)} className={styles.date}>
            {dateLabel}
          </time>
        </div>
        <h4 className={styles.featuredTitle}>{item.title}</h4>
        <p className={styles.featuredText}>{item.description}</p>
        <NewsLink item={item} showArrow ariaLabel={`View details: ${item.title}`}>
          {item.opensExternally ? 'Read article' : 'View details'}
        </NewsLink>
        {item.linkType === 'onPremReference' && <OnPremHint />}
      </div>
    </article>
  );
}

function NewsRow({ item, dateLabel }: { item: ITravelNews; dateLabel: string }): React.ReactElement {
  return (
    <article className={styles.newsRow}>
      <ImageWithFallback src={item.imageUrl} alt="" aspectRatio="1 / 1" className={styles.thumb} />
      <div className={styles.newsRowBody}>
        <NewsLink item={item} className={styles.newsRowTitle} ariaLabel={item.title}>
          {item.title}
        </NewsLink>
        <p className={styles.newsRowText}>{item.description}</p>
        <div className={styles.metaRow}>
          <time dateTime={toIsoDate(item.publishDate)} className={styles.date}>
            {dateLabel}
          </time>
          {item.linkType === 'onPremReference' && <OnPremHint />}
        </div>
      </div>
    </article>
  );
}
