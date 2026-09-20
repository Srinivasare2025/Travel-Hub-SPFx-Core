/**
 * A tiny opt-in markup convention read from `IPolicyCard.subPoints` (the
 * existing multi-line `SubPoints` text field on `TH_PolicyCards` — no schema
 * change). It lets a handful of specific highlight cards render a mini table,
 * a numbered list, or an icon+heading sub-block instead of a plain bullet
 * list, purely by how their SubPoints text is written — every other card's
 * SubPoints keeps rendering as plain bullets exactly as before, since none of
 * these prefixes normally appear in ordinary bullet text. This keeps the
 * change scoped to the specific cards a content editor opts in on, instead of
 * changing how every `HighlightCards`/`cardVariant: 'highlight'` card looks
 * across every Travel Policy page.
 *
 * Authoring convention (one line per `SubPoints` row):
 * - `##Header 1|Header 2` — starts a mini table; only the first such line in
 *   a card is used as the header.
 * - `Cell 1|Cell 2` (contains `|`, right after a `##` header or another table
 *   row) — a table data row, one cell per header column.
 * - `!!Label|Description` or `!!Description` — an info-icon callout note,
 *   with an optional bold leading label.
 * - `@IconName|Sub-heading|Description` — a small icon + bold sub-heading,
 *   with a description below (e.g. "Less than 30 days").
 * - `@IconName|Bullet text` (only 2 parts) — a plain bullet with its own
 *   icon instead of the usual disc marker, e.g. a responsibilities list
 *   where every line has a different icon.
 * - Any other line — a plain bullet, unless *every* line in the card matches
 *   `1. …` / `1) …` (and none use the markers above), in which case the whole
 *   list renders as colored numbered circles instead of bullets.
 *
 * A leading `%%Tag text` line (checked separately, via `extractTag` below,
 * before the rest is parsed) is pulled out as a small pill badge for the
 * card's header, e.g. "Traveler" / "Approver" — it never appears in the
 * card body itself.
 */
export type ParsedSubPoint =
  | { kind: 'bullet'; text: string }
  | { kind: 'iconBullet'; icon: string; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'callout'; label: string | undefined; text: string }
  | { kind: 'iconBlock'; icon: string; heading: string; text: string }
  | { kind: 'numbered'; items: string[] };

/**
 * Pulls a leading `%%Tag text` line out of a card's `SubPoints` lines (a
 * header badge, e.g. "Traveler" / "Approver"), returning it separately from
 * the remaining lines to parse normally. `undefined` when no such line is
 * present.
 */
export function extractTag(lines: string[]): { tag: string | undefined; rest: string[] } {
  const index = lines.findIndex((l) => l.startsWith('%%'));
  if (index === -1) {
    return { tag: undefined, rest: lines };
  }
  return { tag: lines[index].slice(2).trim(), rest: [...lines.slice(0, index), ...lines.slice(index + 1)] };
}

const NUMBERED_RE = /^\d+[.)]\s+(.*)$/;

export function parseHighlightSubPoints(lines: string[]): ParsedSubPoint[] {
  if (lines.length === 0) {
    return [];
  }

  const hasSpecialMarker = lines.some((l) => l.startsWith('##') || l.startsWith('@') || l.startsWith('!!'));
  if (!hasSpecialMarker && lines.every((l) => NUMBERED_RE.test(l))) {
    return [{ kind: 'numbered', items: lines.map((l) => (NUMBERED_RE.exec(l) as RegExpExecArray)[1]) }];
  }

  const result: ParsedSubPoint[] = [];
  let activeTable: { headers: string[]; rows: string[][] } | undefined;

  const flushTable = (): void => {
    if (activeTable !== undefined) {
      result.push({ kind: 'table', headers: activeTable.headers, rows: activeTable.rows });
      activeTable = undefined;
    }
  };

  for (const line of lines) {
    if (line.startsWith('##')) {
      flushTable();
      activeTable = { headers: line.slice(2).split('|').map((c) => c.trim()), rows: [] };
      continue;
    }
    // A `|` alone isn't enough - a `!!`/`@` line can legitimately contain one
    // too (e.g. `!!Policy note:|text`), and must still be caught by its own
    // marker check below rather than being swallowed as a stray table row.
    if (line.includes('|') && activeTable !== undefined && !line.startsWith('!!') && !line.startsWith('@')) {
      activeTable.rows.push(line.split('|').map((c) => c.trim()));
      continue;
    }
    flushTable();

    if (line.startsWith('!!')) {
      const rest = line.slice(2);
      const sepIndex = rest.indexOf('|');
      if (sepIndex >= 0) {
        result.push({ kind: 'callout', label: rest.slice(0, sepIndex).trim(), text: rest.slice(sepIndex + 1).trim() });
      } else {
        result.push({ kind: 'callout', label: undefined, text: rest.trim() });
      }
      continue;
    }

    if (line.startsWith('@')) {
      const parts = line.slice(1).split('|').map((p) => p.trim());
      if (parts.length >= 3) {
        result.push({ kind: 'iconBlock', icon: parts[0], heading: parts[1], text: parts.slice(2).join('|') });
        continue;
      }
      if (parts.length === 2) {
        result.push({ kind: 'iconBullet', icon: parts[0], text: parts[1] });
        continue;
      }
    }

    result.push({ kind: 'bullet', text: line });
  }
  flushTable();

  return result;
}
