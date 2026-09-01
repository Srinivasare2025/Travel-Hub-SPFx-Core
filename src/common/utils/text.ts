/* eslint-disable @rushstack/no-new-null -- accepts raw SharePoint field values, which are genuinely `null`. */

/**
 * Text helpers. TravelHub renders list text as plain text (React escapes it);
 * there is deliberately no HTML renderer here. If a rich-text field is ever
 * introduced, add a single audited sanitiser in this file and nowhere else
 * (SECURITY.md §4).
 */

/** Collapse a possibly-HTML string to plain text (defensive; used for previews). */
export function stripHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a newline-delimited multi-line field into trimmed, non-empty lines. */
export function splitLines(value: string | null | undefined): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Fill a "{token}" template from a map; unknown tokens and empty values are removed cleanly. */
export function fillTemplate(template: string, values: Record<string, string | undefined>): string {
  const filled = template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');
  // Tidy separators left dangling by empty values, e.g. " – " or trailing commas.
  return filled
    .replace(/\s*[–—-]\s*$/g, '')
    .replace(/^\s*[–—-]\s*/g, '')
    .replace(/\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
