import * as React from 'react';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import styles from './RichHtml.module.scss';

export interface IRichHtmlProps {
  /** Editor-authored HTML (or plain text) - always sanitised before rendering (sanitizeHtml.ts). */
  html: string | undefined;
  className?: string;
}

/**
 * Article-style rich content: headings, paragraphs, lists, tables, quotes and
 * images placed anywhere in the text (a news article's body, an event's
 * details). The markup is rebuilt by the allow-list sanitiser first, so no
 * script, style or event handler from the source ever reaches the page.
 */
export const RichHtml: React.FC<IRichHtmlProps> = ({ html, className }) => {
  const safe = React.useMemo(() => sanitizeHtml(html), [html]);
  if (safe.length === 0) {
    return null;
  }
  // Sanitised by the allow-list in sanitizeHtml.ts.
  return <div className={`${styles.rich} ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: safe }} />;
};
