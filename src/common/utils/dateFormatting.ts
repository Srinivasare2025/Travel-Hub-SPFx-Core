/* eslint-disable @rushstack/no-new-null -- accepts raw SharePoint field values, which are genuinely `null`. */

/**
 * Date formatting helpers. All display formatting goes through here so locale and
 * optional Hijri rendering stay consistent. Services expose `Date`; components
 * format at render time.
 */

export interface IDateFormatOptions {
  locale: string;
  showHijri: boolean;
  hijriLocale: string;
}

function isValidDate(value: Date | undefined): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/** Parse a SharePoint ISO date string to a `Date`, or `undefined` when unusable. */
export function parseSpDate(raw: string | null | undefined): Date | undefined {
  if (raw === null || raw === undefined || raw === '') {
    return undefined;
  }
  const d = new Date(raw);
  return isValidDate(d) ? d : undefined;
}

/** e.g. "15 May 2024" (locale-driven). */
export function formatLongDate(date: Date | undefined, opts: IDateFormatOptions): string {
  if (!isValidDate(date)) {
    return '';
  }
  return new Intl.DateTimeFormat(opts.locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/** Day + short month, for event date blocks, e.g. { day: "20", month: "MAR" }. */
export function formatDateBlock(
  date: Date | undefined,
  opts: IDateFormatOptions
): { day: string; month: string } {
  if (!isValidDate(date)) {
    return { day: '', month: '' };
  }
  const day = new Intl.DateTimeFormat(opts.locale, { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat(opts.locale, { month: 'short' })
    .format(date)
    .toUpperCase();
  return { day, month };
}

/** Hijri (Umm al-Qura) rendering of a date, empty string when disabled or invalid. */
export function formatHijriDate(date: Date | undefined, opts: IDateFormatOptions): string {
  if (!opts.showHijri || !isValidDate(date)) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(opts.hijriLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch {
    return '';
  }
}

/** ISO date (yyyy-mm-dd) for `datetime` attributes. */
export function toIsoDate(date: Date | undefined): string {
  return isValidDate(date) ? date.toISOString().slice(0, 10) : '';
}
