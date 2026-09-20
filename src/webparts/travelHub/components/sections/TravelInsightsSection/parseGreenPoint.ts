/**
 * A tiny opt-in markdown-style convention read from `IGreenTravel.points`
 * (the existing multi-line `Points` field — no schema change): a line
 * written as `**Heading:** description text` renders with a bold
 * sub-heading followed by its description; a plain line renders as-is with
 * no heading. Lets a content editor add a heading just by typing `**…**`,
 * the same convention Markdown authors already know.
 */
export interface IParsedGreenPoint {
  heading: string | undefined;
  text: string;
}

const HEADING_RE = /^\*\*(.+?)\*\*\s*:?\s*(.*)$/;

export function parseGreenPoint(line: string): IParsedGreenPoint {
  const match = HEADING_RE.exec(line);
  if (match !== null) {
    return { heading: match[1].trim(), text: match[2].trim() };
  }
  return { heading: undefined, text: line };
}
