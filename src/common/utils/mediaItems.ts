import { sanitizeUrl } from './urlValidation';

/** How a popup item is shown: `image` = `<img>`, `document` = `<iframe>` (PDF, SharePoint embed page, …). */
export type MediaItemKind = 'image' | 'document';

/** One file opened in the in-app `MediaViewer` popup, e.g. a city guide PDF or a gallery photo. */
export interface IMediaItem {
  /** Tab label / caption, e.g. "Riyadh". May be empty. */
  label: string;
  /** Validated URL. */
  url: string;
  kind: MediaItemKind;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#]|$)/i;
const KIND_KEYWORDS: Readonly<Record<string, MediaItemKind>> = {
  image: 'image',
  img: 'image',
  photo: 'image',
  pdf: 'document',
  document: 'document',
  doc: 'document',
  page: 'document'
};

/** `image` for a URL ending in an image extension, otherwise `document`. */
export function guessMediaKind(url: string): MediaItemKind {
  return IMAGE_EXT_RE.test(url) ? 'image' : 'document';
}

/**
 * Parses a multi-line "popup content" field (TH_PolicyCards.PopupContent),
 * one file per line:
 *
 *   https://…/RiyadhGuide.pdf              bare URL (no label)
 *   Riyadh | https://…/RiyadhGuide.pdf     label + URL
 *   Poster | https://…/getimage?id=7 | image   label + URL + explicit kind
 *
 * The kind (`image` / `pdf`) is only needed when the URL has no file
 * extension to guess it from. Lines with an unsafe or missing URL are
 * dropped (see `sanitizeUrl`).
 */
export function parseMediaItems(lines: ReadonlyArray<string>): IMediaItem[] {
  const items: IMediaItem[] = [];
  lines.forEach((raw) => {
    const parts = raw.split('|').map((p) => p.trim());
    const [label, rawUrl, rawKind] = parts.length === 1 ? ['', parts[0], undefined] : parts;
    const url = sanitizeUrl(rawUrl);
    if (url === undefined || url === '#' || /^(mailto|tel):/i.test(url)) {
      return;
    }
    const kind = (rawKind !== undefined ? KIND_KEYWORDS[rawKind.toLowerCase()] : undefined) ?? guessMediaKind(url);
    items.push({ label, url, kind });
  });
  return items;
}
