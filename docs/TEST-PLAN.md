# TravelHub – Test Plan

## What this is

The test strategy and case matrix. Testing runs inside the Heft toolchain
(`heft test`, Jest via `@types/heft-jest`) plus manual accessibility and UAT
passes. Each development phase delivers its own tests; this document is the
umbrella and the acceptance checklist.

## Test levels

| Level | Tooling | Scope | When |
| --- | --- | --- | --- |
| Unit | Jest + React Testing Library (RTL) | utils, hooks, services (mocked PnPjs), components (mocked services) | every phase, CI gate |
| Integration | Jest + RTL, mocked `SPFI` returning fixture JSON | section ↔ service ↔ model wiring, batching, error propagation | per section phase |
| Contract | Jest | service output matches DATA-MODEL.md interfaces (type-level + runtime shape) | per service |
| Accessibility | `jest-axe` (automated) + manual (keyboard, screen reader) | every interactive component, whole page | phase 12 + per interactive component |
| Performance | manual (Edge DevTools, `$batch` inspection), Lighthouse | request count, payload, CLS, LCP | phase 12 + spot per phase |
| Security | manual + `grep` checks | URL validation, `dangerouslySetInnerHTML`, permissions | phase 12 (checklist in SECURITY.md §9) |
| UAT | manual, business | mock fidelity, content editing, config changes | phase 13 |

> RTL is a dev-only dependency (`@testing-library/react` + `@testing-library/jest-dom`
> + `jest-axe`) added in Phase 3 with the common component library. Justification:
> the SPFx Jest rig ships no component-testing helper; RTL is the standard,
> lightweight choice and matches React 17. Confirmed at install time.

## Coverage targets

- Services & utils: **90%+** lines/branches (they hold the risk: mapping,
  validation, filtering, access checks).
- Hooks: **85%+**.
- Components: **70%+**, with the four states (loading/success/empty/error) and
  keyboard paths always covered.
- No target on generated/loc files.

## Unit test matrix

### Utils
| Unit | Cases |
| --- | --- |
| `isSafeUrl` / `sanitizeUrl` | https/http/mailto/tel/relative pass; `javascript:`, `data:`, `vbscript:`, `file:`, `  javascript:` (whitespace), mixed-case `JavaScript:`, empty, `undefined` all rejected |
| `formatDate` | valid date + locale; invalid date → fallback; timezone stability |
| `formatHijri` | known Gregorian → expected Hijri (um-al-qura); flag off → not called |
| `stripHtml` / sanitiser | strips `<script>`, `on*`, `style`, `iframe`; keeps allow-list tags; `href` re-validated |
| `mailto`/`tel` builders | strips CRLF, encodes subject, rejects non-digit phone junk |

### Hooks
| Unit | Cases |
| --- | --- |
| `useAsyncData` | idle→loading→success; loading→empty (array len 0); loading→error; `retry()` re-runs; unmount cancels (no setState warning); deps change refetches |
| `useCarousel` | next/prev/goTo wrap + clamp; autoplay advances on interval; pause on hover/focus/tab-hidden/reduced-motion; keyboard arrows/Home/End; swipe threshold |
| `useReducedMotion` | reflects matchMedia; updates on change event |

### Services (mocked `SPFI` / fixtures)
| Unit | Cases |
| --- | --- |
| `ConfigurationService` | defaults when list empty; row overlays default; bad `ValueType`/out-of-range → default + `Log.warn`; unsafe URL value → default; caching (second call no fetch within TTL) |
| `HeroBannerService` | maps fields; filters `IsActive` + date window; sorts `DisplayOrder`; video row without `VideoUrl` dropped/flagged; unsafe image URL → undefined |
| `TravelService` | `select` list matches DATA-MODEL; `linkType` mapping; `openInNewTab` coercion; window filter; `top` cap applied |
| `NewsService` | featured selection order; `OnPremReference` retained + flagged when flag on, dropped when off; date parse |
| `EventService` | only future/today events; `EventDate` required (row without it dropped); time strings |
| `TravelTipsService` | optional link validation; order |
| `QuickPulseService` | read returns question+options only; `getAccess` group check; **submit**: dup-check prevents 2nd insert when `OneResponsePerUser`; write model shape; never returns response rows for non-admin; aggregate has no per-user data |
| `TestimonialService` | rating clamp 1–5; `personInfoLine` explicit wins; else template compose; missing pieces handled |
| `TravelSpendService` (SharePoint impl) | `getAccess` denied → `getSpend` not called; denied reason mapping; no calculation performed; numbers passed through; no storage caching |
| `TravelTeamService` | landing count vs cache count; email/phone sanitised; order |
| `FooterService` | links joined to columns by `ColumnId`; empty column allowed; unsafe link URL dropped; ≤ 6 columns enforced |

### Components (mocked services)
For **every** section/common component:
| Case | Assertion |
| --- | --- |
| loading | skeleton variant rendered, dimensions reserved (no CLS) |
| success | correct data rendered, headings hierarchy correct, images have `alt` |
| empty | friendly message, no console error |
| error | `ErrorState` with working `onRetry` → refetch |
| keyboard | all controls reachable + operable; focus visible; carousel arrow keys |
| a11y | `jest-axe` no violations |
| config | respects injected config (e.g. `desktopVisibleCards`, `isVisible`, `viewAll` url/text) |
| security | link with unsafe URL → not rendered as link; `target=_blank` → `rel=noopener noreferrer` |

Section-specific:
| Component | Extra cases |
| --- | --- |
| `HeroCarousel` | quick links **not** inside the carousel DOM; video muted, no autoplay-sound; per-slide duration honoured |
| `TravelServicesCarousel` | card count changes with viewport/config; dots count = pages |
| `QuickPulseCard` | submit → confirmation state; reload/already-responded → locked state; "View Previous Results" hidden for non-admin when `showAggregateResults=false` |
| `DepartmentTravelSpendCard` | denied → forbidden panel + dashboard link; permitted → 5 summary tiles, values from model verbatim |
| `GreenTravelCard` | overlay via CSS only (image `src` unchanged); points list from newline field |
| `TravelTeamCard` | contact links are `mailto:`/`tel:` only |
| `TravelHubFooter` | renders exactly the active columns/links in order; `> 6` columns clamped |
| `TravelHub` (orchestrator) | renders sections in mock order; hides a section when `isVisible=false`; a throwing section → error boundary, siblings still render |

## Accessibility acceptance (WCAG 2.1 AA-oriented)

- [ ] Logical heading order (`h2` section titles, `h3`/`h4` within).
- [ ] All images have meaningful `alt` (decorative = `alt=""`).
- [ ] Every carousel: labelled region, prev/next buttons with `aria-label`,
      pagination conveys position, arrow-key support, visible focus, `aria-live`
      polite on slide change, autoplay pauses on focus/hover and respects
      reduced motion.
- [ ] Colour is never the only signal (badges have text, ratings have text/aria).
- [ ] Contrast: text on gold `#b89c66` and navy `#04253c` verified ≥ 4.5:1 (or
      large-text 3:1); adjust token usage, not the brand hex.
- [ ] Forms (Quick Pulse): labelled options, grouped with `fieldset`/`legend` or
      `radiogroup`, error/confirmation announced.
- [ ] Keyboard-only: entire page operable, no traps, skip past carousels.
- [ ] Screen-reader spot check (NVDA/JAWS/VoiceOver) of hero, pulse, testimonials.

## Performance acceptance

- [ ] First load = one `$batch` for the above-the-fold tier (≤ ~8 sub-requests).
- [ ] No service issues `select('*')`.
- [ ] Below-the-fold sections deferred (verified: no team/footer image requests
      until scrolled/idle).
- [ ] CLS < 0.05 from the web part; skeletons match final size.
- [ ] Images within the size budget (PERFORMANCE.md table).
- [ ] Autoplay timers stop on tab hide / unmount (verified in DevTools).

## Test data / fixtures

- JSON fixtures per list under `src/**/__tests__/fixtures/` mirroring the mock
  content (6 services, 3 news, 5 events, 7 tips, 5 pulse options, 3 testimonials,
  4 team members, 6 footer columns).
- A "sparse" fixture set (0–1 items) to exercise empty/featured-only paths.
- A "hostile" fixture set (unsafe URLs, HTML in text, missing required dates,
  huge strings) to exercise validation.

## Definition of done (per section phase)

Code + tests (unit + the four states + keyboard + axe) green in `npm run build`,
mock fidelity reviewed against the image, PERFORMANCE + SECURITY notes recorded
in the phase write-up, no unrelated file changed.
