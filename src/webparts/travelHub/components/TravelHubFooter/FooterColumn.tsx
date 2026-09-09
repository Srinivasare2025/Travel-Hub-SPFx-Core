import * as React from 'react';
import { ExternalLink } from '../../../../common/components';
import { IFooterColumn } from '../../../../models';
import styles from './TravelHubFooter.module.scss';

/** One footer column: title + its ordered links. */
export const FooterColumn: React.FC<{ column: IFooterColumn }> = ({ column }) => (
  <div className={styles.column}>
    {column.title.length > 0 && <h3 className={styles.columnTitle}>{column.title}</h3>}
    <ul className={styles.linkList}>
      {column.links.map((link) => (
        <li key={link.id}>
          <ExternalLink href={link.url} openInNewTab={link.openInNewTab} className={styles.link}>
            {link.title}
          </ExternalLink>
        </li>
      ))}
    </ul>
  </div>
);
