/** Small, dependency-free collection helpers used by the service layer. */

/** Stable sort by a numeric selector (ascending), then an optional tiebreaker. */
export function orderBy<T>(
  items: readonly T[],
  primary: (item: T) => number,
  tiebreaker?: (item: T) => number
): T[] {
  return [...items].sort((a, b) => {
    const diff = primary(a) - primary(b);
    if (diff !== 0 || tiebreaker === undefined) {
      return diff;
    }
    return tiebreaker(a) - tiebreaker(b);
  });
}

/** Coerce a SharePoint boolean-ish value to a real boolean. */
export function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') {
      return true;
    }
    if (v === 'false' || v === '0' || v === 'no') {
      return false;
    }
  }
  return fallback;
}

/** Coerce to a finite number within optional bounds, else the fallback. */
export function toNumber(
  value: unknown,
  fallback: number,
  bounds?: { min?: number; max?: number }
): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!isFinite(n)) {
    return fallback;
  }
  if (bounds?.min !== undefined && n < bounds.min) {
    return bounds.min;
  }
  if (bounds?.max !== undefined && n > bounds.max) {
    return bounds.max;
  }
  return n;
}

/** Trim to string, mapping null/undefined/empty to `undefined`. */
export function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

/** Trim to string with a fallback for null/undefined/empty. */
export function toStringOr(value: unknown, fallback: string): string {
  return toOptionalString(value) ?? fallback;
}
