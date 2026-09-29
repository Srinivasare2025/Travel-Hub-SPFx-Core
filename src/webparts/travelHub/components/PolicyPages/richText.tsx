import * as React from 'react';

/**
 * Inline formatting for plain-text list content (card descriptions, SubPoints
 * lines, Feature/Split text). No HTML is ever injected - the text is split
 * into React nodes:
 *
 * - `**bold**`                      -> <strong>
 * - an email address                 -> mailto: link
 * - `https://…` / `http://…`         -> link (new tab)
 * - a phone number starting with `+` -> tel: link, e.g. "+966 11 413 6116"
 *
 * Anything else renders exactly as typed.
 */
const TOKEN_RE =
  /(\*\*[^*]+\*\*)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(https?:\/\/[^\s<>"')]+)|(\+\d[\d\s-]{6,}\d)/g;

export function renderRichText(text: string): React.ReactNode {
  if (text.length === 0) {
    return text;
  }
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  TOKEN_RE.lastIndex = 0;
  let match = TOKEN_RE.exec(text);
  while (match !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const [token, bold, email, url, phone] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold.slice(2, -2)}</strong>);
    } else if (email !== undefined) {
      nodes.push(
        <a key={key++} href={`mailto:${email}`}>
          {email}
        </a>
      );
    } else if (url !== undefined) {
      nodes.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      );
    } else if (phone !== undefined) {
      nodes.push(
        <a key={key++} href={`tel:${phone.replace(/[\s-]/g, '')}`}>
          {phone}
        </a>
      );
    } else {
      nodes.push(token);
    }
    last = match.index + token.length;
    match = TOKEN_RE.exec(text);
  }
  if (last === 0) {
    return text;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return <>{nodes}</>;
}
