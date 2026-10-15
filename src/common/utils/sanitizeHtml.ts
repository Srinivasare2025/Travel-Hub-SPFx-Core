import { sanitizeUrl } from './urlValidation';

/**
 * Allow-list HTML sanitiser for editor-authored rich text (a news article's
 * ArticleBody, an event's EventDetails - SharePoint "Enhanced rich text"
 * columns, or the Content Admin screen's editor). SECURITY.md §4: editor
 * content is untrusted, so instead of trusting SharePoint's own filtering
 * this rebuilds the markup from scratch with only:
 *
 * - formatting/structure tags (headings, paragraphs, lists, tables, quotes,
 *   images, figures, links, line breaks, bold/italic/underline);
 * - a handful of attributes (href/src/alt/title/colspan/rowspan) - every
 *   `on*` handler, `style`, `class`, `id` and unknown attribute is dropped;
 * - URLs that pass `sanitizeUrl` (no javascript:/data:/vbscript:).
 *
 * Anything else - <script>, <style>, <iframe>, <object>, forms, SVG - is
 * removed with its content; unknown wrapper tags (span/font/div from Word
 * paste) are unwrapped, keeping their text. Text alignment written by the
 * SharePoint editor (`text-align` style / `align`) is kept as a class.
 */

const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'p', 'br', 'hr', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small', 'mark',
  'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'
]);

/** Removed together with everything inside them. */
const DROP_WITH_CONTENT: ReadonlySet<string> = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'form', 'input', 'button',
  'select', 'textarea', 'link', 'meta', 'base', 'frame', 'frameset', 'audio', 'video', 'canvas', 'title', 'head'
]);

const ATTRS: Record<string, readonly string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  th: ['colspan', 'rowspan', 'scope'],
  td: ['colspan', 'rowspan'],
  ol: ['start']
};

/** `h1` becomes `h2` so an article never competes with the page title. */
const RENAME: Record<string, string> = { h1: 'h2', b: 'strong', i: 'em' };

const ALIGN_RE = /text-align\s*:\s*(left|right|center|justify)/i;

function alignOf(el: Element): string | undefined {
  const fromStyle = ALIGN_RE.exec(el.getAttribute('style') ?? '');
  const value = (fromStyle?.[1] ?? el.getAttribute('align') ?? '').toLowerCase();
  return value === 'center' || value === 'right' || value === 'justify' ? value : undefined;
}

function cleanChildren(source: Node, target: Node, doc: Document): void {
  source.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      target.appendChild(doc.createTextNode(child.textContent ?? ''));
      return;
    }
    if (child.nodeType !== 1) {
      return; // comments, processing instructions
    }
    const el = child as Element;
    const rawTag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(rawTag)) {
      return;
    }
    const tag = RENAME[rawTag] ?? rawTag;
    if (!ALLOWED_TAGS.has(tag)) {
      // Unknown wrapper (div/span/font/section…): keep its content. A block
      // wrapper (div/section/article) keeps paragraph separation.
      // (SharePoint wraps rich text in <div class="ExternalClass…"> - a div
      // that already holds blocks is simply unwrapped, never nested in a <p>.)
      const holdsBlocks = el.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,table,div,blockquote,figure,pre,section,article') !== null;
      if ((rawTag === 'div' || rawTag === 'section' || rawTag === 'article') && !holdsBlocks) {
        const p = doc.createElement('p');
        const align = alignOf(el);
        if (align !== undefined) {
          p.className = `th-align-${align}`;
        }
        cleanChildren(el, p, doc);
        if ((p.textContent ?? '').trim().length > 0 || p.querySelector('img') !== null) {
          target.appendChild(p);
        }
      } else {
        cleanChildren(el, target, doc);
      }
      return;
    }

    const out = doc.createElement(tag);
    (ATTRS[tag] ?? []).forEach((name) => {
      const value = el.getAttribute(name);
      if (value === null) {
        return;
      }
      if (name === 'href' || name === 'src') {
        const safe = sanitizeUrl(value);
        if (safe !== undefined) {
          out.setAttribute(name, safe);
        }
        return;
      }
      if ((name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan' || name === 'start') && !/^\d{1,4}$/.test(value)) {
        return;
      }
      out.setAttribute(name, value.slice(0, 300));
    });
    if (tag === 'a') {
      const href = out.getAttribute('href');
      if (href === null) {
        cleanChildren(el, target, doc); // a link with an unsafe URL becomes plain text
        return;
      }
      if (/^https?:\/\//i.test(href)) {
        out.setAttribute('target', '_blank');
        out.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (tag === 'img') {
      if (out.getAttribute('src') === null) {
        return;
      }
      out.setAttribute('loading', 'lazy');
      out.setAttribute('decoding', 'async');
    }
    const align = alignOf(el);
    if (align !== undefined) {
      out.className = `th-align-${align}`;
    }
    cleanChildren(el, out, doc);
    target.appendChild(out);
  });
}

/** Whether a value looks like HTML (vs. plain text with line breaks). */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Returns safe HTML for `dangerouslySetInnerHTML`. Plain text is escaped and its line breaks kept as paragraphs. */
export function sanitizeHtml(input: string | undefined): string {
  if (input === undefined || input.trim().length === 0) {
    return '';
  }
  if (typeof DOMParser === 'undefined') {
    return '';
  }
  const parser = new DOMParser();
  if (!looksLikeHtml(input)) {
    const doc = parser.parseFromString('<!doctype html><body></body>', 'text/html');
    const body = doc.body;
    input
      .split(/\n{2,}|\r\n\r\n/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
      .forEach((block) => {
        const p = doc.createElement('p');
        block.split(/\r?\n/).forEach((line, i) => {
          if (i > 0) {
            p.appendChild(doc.createElement('br'));
          }
          p.appendChild(doc.createTextNode(line));
        });
        body.appendChild(p);
      });
    return body.innerHTML;
  }
  const source = parser.parseFromString(input, 'text/html');
  const out = parser.parseFromString('<!doctype html><body></body>', 'text/html');
  cleanChildren(source.body, out.body, out);
  return out.body.innerHTML;
}

/** Plain-text version of rich content (card excerpts, search). */
export function htmlToText(input: string | undefined): string {
  if (input === undefined || input.length === 0) {
    return '';
  }
  if (!looksLikeHtml(input) || typeof DOMParser === 'undefined') {
    return input;
  }
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
