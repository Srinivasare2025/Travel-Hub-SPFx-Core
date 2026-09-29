import * as React from 'react';
import { ExternalLink } from '../ExternalLink';
import styles from './SectionHeader.module.scss';

export interface ISectionHeaderProps {
  title: string;
  /** Heading level for correct document outline (h2 for sections, h3 for cards). */
  headingLevel?: 2 | 3 | 4;
  viewAll?: { text: string; url: string; openInNewTab?: boolean };
  /** Optional slot on the right (e.g. carousel controls) — replaces viewAll when both given. */
  actions?: React.ReactNode;
  id?: string;
}

/** Section / card title with an optional right-aligned "View All" link. */
export const SectionHeader: React.FC<ISectionHeaderProps> = ({
  title,
  headingLevel = 2,
  viewAll,
  actions,
  id
}) => {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  // h2 gets the larger, page-level title style; h3/h4 (card-level titles,
  // e.g. the three Travel Updates cards) get the smaller card-title style so
  // they reliably fit on one line — see SectionHeader.module.scss.
  const sizeClass = headingLevel === 2 ? styles.level2 : styles.level3;
  return (
    <div className={styles.root}>
      <Heading className={`${styles.title} ${sizeClass}`} id={id}>
        {title}
      </Heading>
      {actions !== undefined ? (
        <div className={styles.actions}>{actions}</div>
      ) : (
        viewAll !== undefined && (
          <ExternalLink
            href={viewAll.url}
            openInNewTab={viewAll.openInNewTab}
            showArrow
            className={styles.viewAll}
            ariaLabel={`${viewAll.text}: ${title}`}
          >
            {viewAll.text}
          </ExternalLink>
        )
      )}
    </div>
  );
};
