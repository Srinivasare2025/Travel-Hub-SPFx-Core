/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */

/**
 * The RSG brand palette (primary + secondary colours). Each colour is also a
 * design token `--full-brand-<key>` (_tokens.scss) - keep the two in step.
 * `ink` is the shade to use for TEXT/icons on a light background (WCAG AA
 * 4.5:1 on white and the light canvases); `on` is the text colour to use ON a
 * fill of the colour itself. Light brand colours (Gold, Crystal Waters, Sandy
 * Dunes, Thriving Corals, Blooming Nature) are below 4.5:1 on white, so they
 * get navy text on top and a darker ink for text.
 */
export interface IBrandColor {
  /** Token key: `--full-brand-<key>`. */
  key: string;
  /** Display name, as typed by content editors, e.g. "Blue Lagoon". */
  name: string;
  hex: string;
  ink: string;
  on: string;
}

const NAVY = '#04253c';
const WHITE = '#ffffff';

export const BRAND_COLORS: ReadonlyArray<IBrandColor> = [
  { key: 'navy', name: 'Navy Blue', hex: NAVY, ink: NAVY, on: WHITE },
  { key: 'gold', name: 'Gold', hex: '#b89c67', ink: '#7b6945', on: NAVY },
  { key: 'crystal-waters', name: 'Crystal Waters', hex: '#54c0e8', ink: '#2c6a80', on: NAVY },
  { key: 'blue-lagoon', name: 'Blue Lagoon', hex: '#007481', ink: '#00636e', on: WHITE },
  { key: 'blooming-nature', name: 'Blooming Nature', hex: '#00946e', ink: '#007357', on: NAVY },
  { key: 'majestic-mountains', name: 'Majestic Mountains', hex: '#852e2c', ink: '#852e2c', on: WHITE },
  { key: 'thriving-corals', name: 'Thriving Corals', hex: '#ff5c35', ink: '#b0401f', on: NAVY },
  { key: 'sandy-dunes', name: 'Sandy Dunes', hex: '#f4b223', ink: '#7f5c10', on: NAVY },
  { key: 'volcanic-ash', name: 'Volcanic Ash', hex: '#6f7271', ink: '#5d6160', on: WHITE },
  { key: 'pearl-bush', name: 'Pearl Bush', hex: '#f3efeb', ink: '#5d6160', on: NAVY },
  { key: 'white', name: 'White', hex: WHITE, ink: NAVY, on: NAVY },
  { key: 'black', name: 'Black', hex: '#000000', ink: '#000000', on: WHITE }
];

/** "Blue Lagoon" / "blue-lagoon" / "BlueLagoon" / "Navy" -> the brand colour. */
const BRAND_BY_NAME: ReadonlyMap<string, IBrandColor> = (() => {
  const map = new Map<string, IBrandColor>();
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');
  BRAND_COLORS.forEach((c) => {
    map.set(norm(c.name), c);
    map.set(norm(c.key), c);
  });
  map.set('navy', BRAND_COLORS[0]);
  return map;
})();

export function findBrandColor(raw: string | null | undefined): IBrandColor | undefined {
  const v = (raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return v.length > 0 ? BRAND_BY_NAME.get(v) : undefined;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TOKEN_RE = /^--full-[a-z0-9-]+$/;
const VAR_TOKEN_RE = /^var\((--full-[a-z0-9-]+)\)$/;

function expandHex(hex: string): string {
  const h = hex.slice(1);
  return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase() : `#${h.toLowerCase()}`;
}

function luminance(hex: string): number {
  const h = expandHex(hex).slice(1);
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mixes `hex` toward black until it reaches 4.5:1 on white - an AA "ink" shade. */
function inkOf(hex: string): string {
  const full = expandHex(hex);
  if (contrastRatio(full, WHITE) >= 4.5) {
    return full;
  }
  const rgb = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16));
  for (let t = 0.95; t > 0; t -= 0.05) {
    const candidate = `#${rgb.map((c) => `0${Math.round(c * t).toString(16)}`.slice(-2)).join('')}`;
    if (contrastRatio(candidate, WHITE) >= 4.5) {
      return candidate;
    }
  }
  return NAVY;
}

/** The colour itself plus its readable text roles (see `IBrandColor`). */
export interface IColorRoles {
  /** CSS value of the colour (hex or `var(--full-…)`). */
  value: string;
  /** Text colour on a fill of `value`. */
  on: string;
  /** AA text/icon shade of `value` on a light background. */
  ink: string;
}

/**
 * Resolves an editor-entered colour (TH_PolicyCards.IconColor,
 * TH_TravelServices.IconBackgroundColor, …) to CSS plus readable text roles.
 * Accepts a brand colour name ("Blue Lagoon", "Gold", "Navy"), a hex value
 * (`#007481`), a design token name (`--full-primary`) or `var(--full-…)`.
 * Anything else (incl. arbitrary CSS) is rejected - `undefined`.
 */
export function resolveColor(raw: string | null | undefined): IColorRoles | undefined {
  const v = (raw ?? '').trim();
  if (v.length === 0) {
    return undefined;
  }
  const brand = findBrandColor(v);
  if (brand !== undefined && !v.startsWith('#') && !v.startsWith('-') && !v.startsWith('var(')) {
    return { value: `var(--full-brand-${brand.key}, ${brand.hex})`, on: brand.on, ink: brand.ink };
  }
  if (HEX_RE.test(v)) {
    const hex = expandHex(v);
    const known = BRAND_COLORS.find((c) => c.hex === hex);
    if (known !== undefined) {
      return { value: hex, on: known.on, ink: known.ink };
    }
    return { value: hex, on: contrastRatio(hex, WHITE) >= 4.5 ? WHITE : NAVY, ink: inkOf(hex) };
  }
  const token = TOKEN_RE.test(v) ? v : VAR_TOKEN_RE.exec(v)?.[1];
  if (token !== undefined) {
    const brandToken = /^--full-brand-([a-z-]+)$/.exec(token);
    const known = brandToken !== null ? BRAND_COLORS.find((c) => c.key === brandToken[1]) : undefined;
    // An unknown token's lightness can't be known here - assume a dark fill.
    return { value: `var(${token})`, on: known?.on ?? WHITE, ink: known !== undefined ? known.ink : `var(${token})` };
  }
  return undefined;
}

/**
 * Safe CSS colour for an inline `style` value: a brand colour name, #rgb/#rrggbb,
 * or a `--full-*` design token (bare or as `var(…)`). Falls back otherwise.
 */
export function safeColor(raw: string | null | undefined, fallback: string): string {
  return resolveColor(raw)?.value ?? fallback;
}

/** Readable text colour on a fill of `raw` (navy on light colours, white on dark ones). */
export function onColor(raw: string | null | undefined, fallback: string = WHITE): string {
  return resolveColor(raw)?.on ?? fallback;
}
