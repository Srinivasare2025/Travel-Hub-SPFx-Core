/**
 * Per-image display hints, written by content editors at the END of any
 * image URL as a `#fragment` - so every image field on every list supports
 * them without a schema change, and the browser ignores the fragment when it
 * downloads the file:
 *
 *   https://…/Travel%20Hub%20Images/sap-hero.jpg#focus=top
 *   https://…/partner-logo.png#fit=contain
 *   https://…/team/photo.jpg#focus=50% 20%&fit=cover
 *
 * - `focus` - which part of the photo must stay visible when the frame crops
 *   it: `top`, `bottom`, `left`, `right`, `center`, `top left`, … or `x% y%`.
 * - `fit`   - `cover` (default: fill the frame, cropping the overflow) or
 *   `contain` (show the WHOLE image; the spare space is filled with a soft
 *   blurred copy of the same picture instead of empty bars).
 *
 * The Content Admin screen writes these for the editor via a "Focus" picker
 * (AdminScreen.tsx), so nobody has to remember the syntax.
 */

export type ImageFit = 'cover' | 'contain';

export interface IImageHints {
  /** The URL without the hint fragment (what is actually downloaded). */
  src: string;
  /** CSS `object-position` / `background-position`, or `undefined` for the frame's default. */
  position: string | undefined;
  fit: ImageFit | undefined;
}

const KEYWORDS: ReadonlySet<string> = new Set(['top', 'bottom', 'left', 'right', 'center']);
const PERCENT_RE = /^\d{1,3}%$/;

/** Normalises an editor-typed focus value into a safe CSS position, or `undefined` when unrecognised. */
export function toCssPosition(raw: string): string | undefined {
  const parts = raw
    .trim()
    .toLowerCase()
    .replace(/[-_+]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0 || parts.length > 2) {
    return undefined;
  }
  if (!parts.every((p) => KEYWORDS.has(p) || PERCENT_RE.test(p))) {
    return undefined;
  }
  // A single vertical keyword ("top") reads as "center top"; CSS accepts it
  // either way, but this keeps the value predictable for both object- and
  // background-position.
  if (parts.length === 1 && (parts[0] === 'top' || parts[0] === 'bottom')) {
    return `center ${parts[0]}`;
  }
  return parts.join(' ');
}

/** Splits an image URL into the real source and its `#focus=…&fit=…` hints. Safe for `undefined`. */
export function parseImageHints(url: string | undefined): IImageHints | undefined {
  if (url === undefined) {
    return undefined;
  }
  const hashAt = url.indexOf('#');
  if (hashAt < 0) {
    return { src: url, position: undefined, fit: undefined };
  }
  const src = url.slice(0, hashAt);
  let position: string | undefined;
  let fit: ImageFit | undefined;
  url
    .slice(hashAt + 1)
    .split('&')
    .forEach((pair) => {
      const eq = pair.indexOf('=');
      if (eq < 0) {
        return;
      }
      const key = pair.slice(0, eq).trim().toLowerCase();
      let value = pair.slice(eq + 1);
      try {
        value = decodeURIComponent(value);
      } catch {
        /* keep the raw value */
      }
      if (key === 'focus' || key === 'position') {
        position = toCssPosition(value);
      } else if (key === 'fit') {
        const v = value.trim().toLowerCase();
        fit = v === 'contain' ? 'contain' : v === 'cover' ? 'cover' : undefined;
      }
    });
  return { src, position, fit };
}

/** Re-attaches hints to a bare URL (Admin screen). Empty hints return the bare URL. */
export function withImageHints(url: string, position: string | undefined, fit: ImageFit | undefined): string {
  const bare = url.split('#')[0];
  const parts: string[] = [];
  if (position !== undefined && position.length > 0 && position !== 'center') {
    parts.push(`focus=${position.replace(/\s+/g, '-')}`);
  }
  if (fit === 'contain') {
    parts.push('fit=contain');
  }
  return parts.length > 0 ? `${bare}#${parts.join('&')}` : bare;
}

/**
 * Asks SharePoint/Microsoft 365 for the largest rendition when an editor
 * pasted a thumbnail URL - the usual reason a profile photo or card image
 * "looks blurry": the *link* points at a small preview, not the original.
 *
 * - `/_layouts/15/userphoto.aspx?size=S|M` (profile photos)  -> `size=L` (648px)
 * - `/_layouts/15/getpreview.ashx?…&resolution=0..2`         -> `resolution=6` (largest)
 * - `…/thumbnails/…/small|medium` (Graph / OneDrive)          -> `large`
 * - a SharePoint image rendition `?width=`/`?w=` below 1200  -> removed (original file)
 *
 * Anything else is returned untouched.
 */
export function toHighResImageUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    const relative = parsed.origin === 'https://placeholder.invalid';
    const path = parsed.pathname.toLowerCase();
    let changed = false;

    if (path.endsWith('/userphoto.aspx')) {
      const size = (parsed.searchParams.get('size') ?? '').toUpperCase();
      if (size !== 'L') {
        parsed.searchParams.set('size', 'L');
        changed = true;
      }
    } else if (path.endsWith('/getpreview.ashx')) {
      const res = Number(parsed.searchParams.get('resolution') ?? '0');
      if (!isFinite(res) || res < 6) {
        parsed.searchParams.set('resolution', '6');
        changed = true;
      }
    } else if (/\/thumbnails\/[^/]+\/(small|medium)(\/|$)/.test(path)) {
      parsed.pathname = parsed.pathname.replace(/\/(small|medium)(\/|$)/i, '/large$2');
      changed = true;
    } else if (relative || /\.sharepoint\.com$/i.test(parsed.hostname)) {
      // SharePoint image renditions only - a CDN's ?w= on another host may
      // point at a multi-megabyte original, so those are left alone.
      for (const key of ['width', 'w']) {
        const w = Number(parsed.searchParams.get(key) ?? 'NaN');
        if (isFinite(w) && w > 0 && w < 1200) {
          parsed.searchParams.delete(key);
          changed = true;
        }
      }
    }

    if (!changed) {
      return url;
    }
    const rebuilt = parsed.toString();
    return relative ? rebuilt.replace('https://placeholder.invalid', '') : rebuilt;
  } catch {
    return url;
  }
}
