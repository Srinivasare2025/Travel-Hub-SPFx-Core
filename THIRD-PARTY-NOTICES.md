# Third-Party Notices

## RSG brand typefaces: Larken, Paralucent (fonts)

Larken (display: page/section titles, hero titles, taglines) and Paralucent
(accent: uppercase eyebrow labels) are Red Sea Global brand typefaces,
supplied by RSG (brand assets, 2026-10-08) and used under RSG's own font
licence. They are self-hosted as base64-inlined, Latin-subset WOFF2
`@font-face` rules in `src/common/styles/_fonts.scss`; the converted sources
are `src/common/styles/fonts/larken-latin-{400,700,400-italic}.woff2` and
`paralucent-latin-500.woff2`. **Confirm with RSG Brand that the licence
covers web embedding before production release.**

## Noto Kufi Arabic (font)

RSG brand Arabic typeface. Loaded on demand for RTL sites only
(`src/common/styles/arabicFont.ts`, its own webpack chunk), weights 400/700,
Arabic subset (`src/common/styles/fonts/noto-kufi-arabic-{400,700}.woff2`).
Licensed under the SIL Open Font License, Version 1.1 (same terms as Noto
Sans below).

## Noto Sans (font)

Used as the site-wide body typeface (`--full-font-family` —
`src/common/styles/_tokens.scss`), self-hosted as base64-inlined
`@font-face` rules in `src/common/styles/_fonts-body.scss`, weights 400,
500, 600 and 700. The source `.woff2` files are kept at
`src/common/styles/fonts/noto-sans-latin-{400,500,600,700}.woff2`.

- Copyright 2022 The Noto Project Authors
  (github.com/notofonts/latin-greek-cyrillic)
- Licensed under the SIL Open Font License, Version 1.1. Full text:
  `src/common/styles/fonts/noto-sans-LICENSE_OFL.txt`, and
  http://scripts.sil.org/OFL

Same face and role as the sibling HR-Hub-SPFx solution's own self-hosted
`--font-body` token.
