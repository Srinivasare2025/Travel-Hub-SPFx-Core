# Third-Party Notices

## Cormorant Garamond (font)

Used as the display typeface for the two largest heading tiers (page and
section titles — see `src/common/styles/_typography.scss`) and the Travel
Policy hero corner tagline (`.heroTagline`, italic), self-hosted as
base64-inlined `@font-face` rules in `src/common/styles/_fonts.scss`. The
source `.woff2` files are kept at
`src/common/styles/fonts/cormorant-garamond-latin.woff2` (normal, variable
weight 400–700) and `cormorant-garamond-latin-italic.woff2` (italic, 400).

- Copyright 2015 the Cormorant Project Authors
  (github.com/CatharsisFonts/Cormorant)
- Licensed under the SIL Open Font License, Version 1.1. Full text:
  `src/common/styles/fonts/cormorant-garamond-LICENSE_OFL.txt`, and
  http://scripts.sil.org/OFL

Same face and role (display/body typography split) as the sibling
HR-Hub-SPFx solution's own self-hosted `--font-display` token.

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
