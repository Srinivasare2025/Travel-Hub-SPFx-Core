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
import { ITravelNews } from '../../../../../models';
import { formatLongDate, toIsoDate } from '../../../../../common/utils/dateFormatting';
import styles from './TravelUpdatesSection.module.scss';

/** Travel News & Articles: a featured lead item + a list of further items. */
export const TravelNewsCard: React.FC = () => {
  const { news, configuration } = useServices();
  const { status, data, retry } = useAsyncData(() => news.getNews(configuration), [configuration]);

  const df = configuration.dates;
  const viewAll = configuration.updates.viewAll.news;
  const title = 'Travel News & Articles';

  return (
    <Card as="article" padding="lg" className={styles.column}>
      <SectionHeader title={title} headingLevel={3} viewAll={{ ...viewAll, openInNewTab: true }} />

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
        <ExternalLink
          href={item.targetUrl}
          openInNewTab={item.openInNewTab}
          showArrow
          ariaLabel={`View details: ${item.title}`}
        >
          View details
        </ExternalLink>
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
        <ExternalLink
          href={item.targetUrl}
          openInNewTab={item.openInNewTab}
          className={styles.newsRowTitle}
          ariaLabel={item.title}
        >
          {item.title}
        </ExternalLink>
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
