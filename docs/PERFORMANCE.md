# TravelHub – Performance

## What this is

The performance budget and the per-service cost model. A SharePoint landing page
is loaded constantly by many users; the goals are a fast first paint, a small
number of well-shaped requests, and no layout thrash.

## Targets

| Metric | Target |
| --- | --- |
| SharePoint API calls on first load (all sections) | ≤ 8 requests, ideally 1 batched round-trip |
| Largest Contentful Paint contribution (web part) | < 2.5s on a warm SPO page, broadband |
| Cumulative Layout Shift from the web part | < 0.05 (skeletons reserve space) |
| Main-thread block from a single section render | < 50ms |
| Hero image (desktop) | ≤ 250 KB, served at display size |
| Card/thumbnail image | ≤ 80 KB |
| Bundle size added over scaffold baseline | tracked per phase; PnPjs tree-shaken, no full Fluent import |

## Request strategy

1. **One config read, shared.** `ConfigurationService.getConfiguration()` runs
   once in `onInit()`; the result is passed down as data. No section re-reads
   `TH_SiteConfiguration`.
2. **Batch the first paint.** All initial list reads are issued through a single
   PnPjs batch (`sp.batched()`), so the browser makes one `$batch` round-trip
   instead of ~10. Sections still render independently as their slice resolves.
3. **Server-side shaping, always.**
   - `select()` only the columns in DATA-MODEL.md — never `*`, never expand
     unused lookups.
   - `filter()` `IsActive eq 1` and date windows server-side.
   - `orderBy(DisplayOrder)` server-side.
   - `top(n)` a sane cap per list (see table) — never fetch an unbounded list.
4. **No N+1.** Lookups (`QuestionId`, `ColumnId`) are resolved with a single
   `expand` or a second bulk read keyed by id, then joined in memory.
5. **Lazy / deferred.** Below-the-fold heavy sections (Team, Footer, Green Travel
   image, testimonial images) load on `IntersectionObserver` or after the
   above-the-fold batch settles. Hero + Services + Updates are the priority tier.
6. **Deduplicate.** `useAsyncData` + the service cache ensure a section that
   re-mounts (property-pane change, resize remount) does not refetch within the
   TTL.

## Caching

`MemoryCache` = per-page-load, in-memory, TTL per key. Cleared on navigation.
**No `localStorage` caching of content** (stale-content risk, and forbidden for
pulse/spend data).

| Data | TTL | Rationale |
| --- | --- | --- |
| `TH_SiteConfiguration` | 10 min | changes rarely, read once anyway |
| Hero, Services, Tips, Green Travel, Team, Footer | 5 min | editorial content, tolerant of small staleness |
| News, Events | 2 min | more time-sensitive |
| Quick Pulse question/options | 5 min | |
| Quick Pulse `userHasResponded` | no cache | must reflect the just-submitted state |
| Spend + spend access | no cache | sensitive + must be current |
| Testimonials | 5 min | |

Optional future layer: a CDN/edge cache or a scheduled export to a JSON file in a
library for very high-traffic tenants — **not** default (invalidation cost).
Recorded in ENHANCEMENT-GUIDE.md.

## Per-service cost model

| Service | Calls (first load) | Payload (typical) | Cap | Pagination | Cache |
| --- | --- | --- | --- | --- | --- |
| `ConfigurationService` | 1 | ~3–8 KB (≤ ~60 rows) | `top(200)` | no | 10 min |
| `HeroBannerService` | 1 | ~2–5 KB (≤ ~6 slides) | `top(20)` | no | 5 min |
| `TravelService` | 1 | ~4–10 KB (≤ ~12 cards) | `top(50)` | no (carousel paginates client-side) | 5 min |
| `NewsService` | 1 | ~5–12 KB (featured + ~5) | `top(10)` | "View All" → separate page | 2 min |
| `EventService` | 1 | ~4–10 KB (~5 upcoming) | `top(10)`, `filter EventDate ge today` | "View All" page | 2 min |
| `TravelTipsService` | 1 | ~2–5 KB (~8 tips) | `top(25)` | "View All" page | 5 min |
| `QuickPulseService` (read) | 1–2 | < 2 KB | `top(1)` question + `top(20)` options | no | 5 min / none |
| `QuickPulseService` (submit) | 1 write (+1 dup-check) | tiny | — | — | none |
| `TestimonialService` | 1 | ~4–10 KB (~10) | `top(30)` | client carousel | 5 min |
| `TravelSpendService` | 1 access + 0–1 data | small | 1 department row | no | none |
| `TravelTeamService` | 1 | ~3–8 KB (landing shows ~4, cache ~20) | `top(50)` | "View All" page | 5 min |
| `FooterService` | 1–2 | ~2–6 KB | `top(10)` columns, `top(100)` links | no | 5 min |

With batching, the **first paint issues one `$batch`** containing config + hero +
services + news + events + tips + testimonials + footer reads (~8 sub-requests);
spend access and team load just after. Submit and "View All" navigations are the
only later calls.

## Rendering performance

- **Skeletons reserve final dimensions** → no CLS when data arrives.
- `Carousel` renders only visible + 1 buffer slide; images `loading="lazy"`,
  `decoding="async"`, explicit `width`/`height` or `aspect-ratio`.
- `React.memo` on `TravelServiceCard`, `TravelTeamCard`, testimonial card,
  `FooterColumn` (list items with stable props). `useCallback` for carousel
  handlers passed into memoised children. `useMemo` for derived/sorted lists.
  Nothing memoised speculatively.
- Autoplay timers use a single `setInterval` per carousel, cleared on unmount /
  pause / tab hidden (`visibilitychange`) / reduced motion.
- No inline object/array literals as props on hot paths (breaks memoisation).
- Event handlers are not recreated per render where a child is memoised.

## Images (editor guidance — put in the Images library description)

| Slot | Recommended source size | Format |
| --- | --- | --- |
| Hero desktop | 2000×900, ≤ 250 KB | WebP/JPEG |
| Hero mobile | 900×1100, ≤ 150 KB | WebP/JPEG |
| Service / news / event card | 800×500, ≤ 80 KB | WebP/JPEG |
| Testimonial / team photo | 240×240, ≤ 40 KB | WebP/JPEG |
| Green Travel | 1400×1000, ≤ 200 KB | WebP/JPEG |

`ImageWithFallback` requests SharePoint's image-renditions/`getpreview` sizing
where the URL supports it, and uses `srcset` for mobile vs desktop.

## Anti-patterns (fail review)

- `select('*')` or omitting `select`.
- Fetching a whole list then filtering/sorting/slicing in JS.
- A per-section config read.
- One request per lookup row (N+1).
- Memoising everything "for performance" without a measured reason.
- Autoplay timer that keeps running on a hidden tab or after unmount.
- Full `@fluentui/react` import for one icon.
- Caching spend/pulse data anywhere.
- Blocking all sections behind one `Promise.all` that fails as a unit (each
  section must degrade independently).

## Per-phase performance review

Each section phase records: number of API calls, payload size, cap, pagination
approach, cache TTL, and any memoisation added (with the reason). Phase 12
re-measures the whole page against the targets above.

## Start-up: tiny entry bundle + splash

The web part's entry bundle (`TravelHubWebPart.ts`) deliberately imports only
the SPFx externals, `hostChrome.ts` and `splash.ts` (~12 KB minified). On
evaluation it immediately hides SharePoint's chrome in view mode (M365 suite
bar `#SuiteNavWrapper`, site header, page title, breadcrumb/hub nav, command
bar, comments, footer, and every other canvas section) and paints a branded
loading screen in the viewer's saved canvas. React, Fluent, PnPjs, the
service layer and all components live in the lazily-loaded
`chunk.travel-hub-app` (`mount.tsx`), whose download starts in `onInit()` in
parallel with SharePoint's own start-up; `createServiceRegistry` now runs
inside that chunk. In edit mode (`?Mode=Edit` / `DisplayMode.Edit`) the chrome
is left visible so authors can edit and publish.

Rule: never add a value import of React, a component or a service to
`TravelHubWebPart.ts` (`import type` is fine) - it would pull the whole app
back into the entry bundle and bring back the "SharePoint page shows first"
delay.

