/* eslint-disable @rushstack/no-new-null -- these helpers accept raw SharePoint field
   values, which are genuinely `null` when a column is empty. */

/**
 * URL safety allow-list. Editor-entered URLs are untrusted (SECURITY.md §4).
 * Only these schemes are permitted; site-relative paths are allowed. Everything
 * else — javascript:, data:, vbscript:, file:, unknown schemes — is rejected.
 */

const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(['https:', 'http:', 'mailto:', 'tel:']);

/**
 * Returns a safe, trimmed URL string, or `undefined` when the value is missing
 * or fails validation. Callers render an affordance only when this returns a value.
 */
export function sanitizeUrl(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }

  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }

  // Protocol-relative URLs ("//host/…") navigate off-origin — always reject.
  if (value.startsWith('//')) {
    return undefined;
  }

  // Site-relative paths are allowed.
  if (value.startsWith('/')) {
    return value;
  }

  // In-page anchors used as inert placeholders.
  if (value === '#') {
    return value;
  }

  let parsed: URL;
  try {
    // Base makes relative parsing deterministic; absolute URLs ignore the base.
    parsed = new URL(value, 'https://invalid.local');
  } catch {
    return undefined;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol.toLowerCase())) {
    return undefined;
  }

  return value;
}

/** Convenience boolean form. */
export function isSafeUrl(raw: string | null | undefined): boolean {
  return sanitizeUrl(raw) !== undefined;
}

/**
 * Build a safe `mailto:` href from a raw address field. Strips CR/LF (header
 * injection) and validates a basic address shape.
 */
export function toMailtoHref(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const address = raw.replace(/[\r\n\s]/g, '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return undefined;
  }
  return `mailto:${address}`;
}

/**
 * Build a safe `tel:` href from a raw phone field. Keeps digits, spaces and a
 * single leading '+'; rejects anything else.
 */
export function toTelHref(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!/^\+?[\d\s()-]{4,}$/.test(trimmed)) {
    return undefined;
  }
  const normalized = trimmed.replace(/[^\d+]/g, '');
  return normalized.length >= 4 ? `tel:${normalized}` : undefined;
}
