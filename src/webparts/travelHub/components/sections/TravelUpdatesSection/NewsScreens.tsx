import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Badge, Button, EmptyState, ErrorState, ImageWithFallback, LoadingState, RichHtml } from '../../../../../common/components';
import { formatLongDate, toIsoDate } from '../../../../../common/utils/dateFormatting';
import { htmlToText } from '../../../../../common/utils/sanitizeHtml';
import type { ITravelNews } from '../../../../../models';
import { NewsLink } from './TravelNewsCard';
import styles from './UpdatesScreens.module.scss';

const PAGE_SIZE = 12;
const ALL = 'All';

/** Breadcrumb shared by the news/events screens. */
export const UpdatesBreadcrumb: React.FC<{ trail: { label: string; onClick?: () => void }[] }> = ({ trail }) => {
  const { navigate } = useNavigation();
  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <button type="button" onClick={() => navigate({ kind: 'hub' })}>
        Home
      </button>
      {trail.map((crumb, index) => (
        <React.Fragment key={crumb.label}>
          <Icon iconName="ChevronRight" aria-hidden="true" />
          {crumb.onClick !== undefined && index < trail.length - 1 ? (
            <button type="button" onClick={crumb.onClick}>
              {crumb.label}
            </button>
          ) : (
            <span aria-current={index === trail.length - 1 ? 'page' : undefined}>{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

/** Category chips + search box used by both "All" screens. */
export const UpdatesFilters: React.FC<{
  categories: string[];
  category: string;
  onCategory: (c: string) => void;
  query: string;
  onQuery: (q: string) => void;
  searchLabel: string;
  children?: React.ReactNode;
}> = ({ categories, category, onCategory, query, onQuery, searchLabel, children }) => (
  <div className={styles.filters}>
    {children}
    {categories.length > 1 && (
      <div className={styles.chips} role="group" aria-label="Filter by category">
        {[ALL, ...categories].map((c) => (
          <button key={c} type="button" className={`${styles.chip} ${c === category ? styles.chipActive : ''}`} aria-pressed={c === category} onClick={() => onCategory(c)}>
            {c}
          </button>
        ))}
      </div>
    )}
    <label className={styles.search}>
      <Icon iconName="Search" aria-hidden="true" />
      <input type="search" value={query} placeholder={searchLabel} aria-label={searchLabel} onChange={(e) => onQuery(e.target.value)} />
    </label>
  </div>
);

function distinctCategories<T extends { category: string | undefined }>(items: T[]): string[] {
  const set: string[] = [];
  items.forEach((i) => {
    if (i.category !== undefined && set.indexOf(i.category) < 0) {
      set.push(i.category);
    }
  });
  return set.sort((a, b) => a.localeCompare(b));
}

function NewsTile({ item, dateLabel, lead = false }: { item: ITravelNews; dateLabel: string; lead?: boolean }): React.ReactElement {
  return (
    <article className={`${styles.tile} ${lead ? styles.tileLead : ''}`}>
      <ImageWithFallback src={item.imageUrl} alt="" aspectRatio="16 / 9" className={styles.tileImage} fallbackIcon="News" />
      <div className={styles.tileBody}>
        <div className={styles.meta}>
          {item.category !== undefined && <Badge text={item.category} tone="gold" />}
          <time dateTime={toIsoDate(item.publishDate)}>{dateLabel}</time>
          {item.opensExternally && (
            <span className={styles.externalHint}>
              <Icon iconName="NavigateExternalInline" aria-hidden="true" /> External
            </span>
          )}
        </div>
        <h2 className={styles.tileTitle}>
          <NewsLink item={item} className={styles.tileTitleLink}>
            {item.title}
          </NewsLink>
        </h2>
        {item.description.length > 0 && <p className={styles.tileText}>{item.description}</p>}
        <NewsLink item={item} showArrow className={styles.tileMore} ariaLabel={`Read: ${item.title}`}>
          {item.opensExternally ? 'Open article' : 'Read more'}
        </NewsLink>
      </div>
    </article>
  );
}

/** "All News & Articles" - every active TH_TravelNews item, filterable by category and searchable. */
export const NewsAllScreen: React.FC = () => {
  const { news, configuration } = useServices();
  const { status, data, retry } = useAsyncData(() => news.getAllNews(configuration), [configuration]);
  const [category, setCategory] = React.useState(ALL);
  const [query, setQuery] = React.useState('');
  const [shown, setShown] = React.useState(PAGE_SIZE);
  const df = configuration.dates;

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (n) =>
        (category === ALL || n.category === category) &&
        (q.length === 0 || n.title.toLowerCase().indexOf(q) >= 0 || n.description.toLowerCase().indexOf(q) >= 0)
    );
  }, [data, category, query]);

  React.useEffect(() => setShown(PAGE_SIZE), [category, query]);

  return (
    <div className={styles.screen}>
      <UpdatesBreadcrumb trail={[{ label: 'News & Articles' }]} />
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Icon iconName="News" />
        </span>
        <div>
          <h1 className={styles.title}>Travel News &amp; Articles</h1>
          <p className={styles.subtitle}>Updates, announcements and stories from the Travel team.</p>
        </div>
      </header>

      {status === 'loading' && <LoadingState variant="grid" count={6} label="Loading news and articles" />}
      {status === 'error' && <ErrorState onRetry={retry} />}
      {status === 'empty' && <EmptyState message="No articles have been published yet." iconName="News" />}

      {status === 'success' && data !== undefined && (
        <>
          <UpdatesFilters
            categories={distinctCategories(data)}
            category={category}
            onCategory={setCategory}
            query={query}
            onQuery={setQuery}
            searchLabel="Search news and articles"
          />
          {items.length === 0 ? (
            <EmptyState message="No articles match your filter." iconName="Search" />
          ) : (
            <>
              <div className={styles.grid}>
                {items.slice(0, shown).map((item, index) => (
                  <NewsTile
                    key={item.id}
                    item={item}
                    dateLabel={formatLongDate(item.publishDate, df)}
                    lead={index === 0 && category === ALL && query.length === 0}
                  />
                ))}
              </div>
              {items.length > shown && (
                <div className={styles.more}>
                  <Button variant="secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                    Show more ({items.length - shown})
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

/** One article - lead image, meta, rich body (ArticleBody), source link, and related articles. */
export const NewsDetailScreen: React.FC<{ id: number }> = ({ id }) => {
  const { news, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(async () => {
    const [item, all] = await Promise.all([news.getNewsItem(id, configuration), news.getAllNews(configuration).catch(() => [] as ITravelNews[])]);
    return { item, all };
  }, [id, configuration]);
  const [copied, setCopied] = React.useState(false);
  const df = configuration.dates;

  if (status === 'loading') {
    return <LoadingState variant="hero" label="Loading the article" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  const item = data?.item;
  if (item === undefined) {
    return (
      <EmptyState
        message="This article isn't available any more."
        iconName="News"
        action={
          <Button variant="secondary" onClick={() => navigate({ kind: 'newsAll' })}>
            All News &amp; Articles
          </Button>
        }
      />
    );
  }

  const related = (data?.all ?? [])
    .filter((n) => n.id !== item.id)
    .sort((a, b) => Number(b.category === item.category) - Number(a.category === item.category))
    .slice(0, 3);
  const hasBody = item.body !== undefined && htmlToText(item.body).length > 0;

  const copyLink = (): void => {
    try {
      navigator.clipboard.writeText(window.location.href).then(() => setCopied(true)).catch(() => undefined);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={styles.screen}>
      <UpdatesBreadcrumb trail={[{ label: 'News & Articles', onClick: () => navigate({ kind: 'newsAll' }) }, { label: item.title }]} />

      <article className={styles.article}>
        <header className={styles.articleHeader}>
          <div className={styles.meta}>
            {item.category !== undefined && <Badge text={item.category} tone="gold" />}
            <time dateTime={toIsoDate(item.publishDate)}>
              <Icon iconName="Calendar" aria-hidden="true" /> {formatLongDate(item.publishDate, df)}
            </time>
          </div>
          <h1 className={styles.articleTitle}>{item.title}</h1>
          {item.description.length > 0 && <p className={styles.articleLead}>{item.description}</p>}
          <div className={styles.articleActions}>
            <Button variant="secondary" onClick={copyLink} iconAfter={copied ? 'CheckMark' : 'Link'}>
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
            {item.targetUrl !== undefined && (
              <Button variant={hasBody ? 'secondary' : 'primary'} href={item.targetUrl} openInNewTab iconAfter="OpenInNewWindow">
                {hasBody ? 'Source page' : 'Read the full article'}
              </Button>
            )}
          </div>
        </header>

        {item.imageUrl !== undefined && (
          <ImageWithFallback src={item.imageUrl} alt="" aspectRatio="16 / 9" className={styles.articleImage} eager />
        )}

        {hasBody && <RichHtml html={item.body} className={styles.articleBody} />}
      </article>

      {related.length > 0 && (
        <section className={styles.related} aria-label="More articles">
          <div className={styles.relatedHeader}>
            <h2 className={styles.relatedTitle}>More News &amp; Articles</h2>
            <Button variant="secondary" onClick={() => navigate({ kind: 'newsAll' })} iconAfter="ChevronRight">
              View All
            </Button>
          </div>
          <div className={styles.grid}>
            {related.map((n) => (
              <NewsTile key={n.id} item={n} dateLabel={formatLongDate(n.publishDate, df)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
