# TravelHub – Architecture

## 1. What this is and why it exists

TravelHub renders one SharePoint page as a set of independent, content-driven
sections. This document defines the layering, folder structure, component
hierarchy, data flow and dependency-injection approach that every phase must
follow. It exists to prevent the two failure modes the project explicitly
forbids: a **monolithic component** and **SharePoint calls scattered through
JSX**.

## 2. Architectural layers

```
┌─────────────────────────────────────────────────────────────┐
│  Web part (composition root)                                 │
│  TravelHubWebPart.ts – property pane, service registration   │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator                                                │
│  TravelHub.tsx – renders <SectionX/> in order, reads config  │
│  for section visibility. NO business logic. NO data calls.   │
├─────────────────────────────────────────────────────────────┤
│  Section components  (one folder each)                       │
│  HeroBanner, TravelServicesCarousel, TravelUpdatesSection…   │
│  Own their loading/empty/error/success state. Call a service │
│  via a hook. Compose common components. No REST/PnPjs in JSX.│
├─────────────────────────────────────────────────────────────┤
│  Common component library  (src/common/components)           │
│  Button, Card, Carousel, SectionHeader, LoadingState, …      │
│  Pure presentational. No services. No SharePoint knowledge.  │
├─────────────────────────────────────────────────────────────┤
│  Service layer  (src/services)                               │
│  HeroBannerService, TravelService, … ConfigurationService.   │
│  The ONLY place that talks to SharePoint / Graph / APIs.     │
│  Returns typed models. Owns field selection, filtering,      │
│  sorting, paging, caching, sanitisation of inbound data.     │
├─────────────────────────────────────────────────────────────┤
│  Data access base  (src/services/base)                       │
│  SharePointService (PnPjs SPFI factory), ICache/MemoryCache, │
│  ServiceKeys, logger. One PnPjs configuration for the app.   │
├─────────────────────────────────────────────────────────────┤
│  Models  (src/models)  – IHeroBanner, ITravelService, …      │
├─────────────────────────────────────────────────────────────┤
│  SharePoint Online: TH_* lists + Travel Hub * libraries      │
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** arrows point downward only. A component may depend on a
service interface and on common components; a service never imports a component;
common components never import services.

## 3. Data flow (one section, e.g. Travel Services)

```
TravelHubWebPart.onInit()
  → builds SPFI (PnPjs) bound to this.context
  → registers service instances in a ServiceContext (React context / prop)

TravelHub.tsx
  → reads ITravelHubConfiguration.sections.travelServices.isVisible
  → if visible renders <TravelServicesCarousel config={cfg} />

TravelServicesCarousel
  → const { status, data, error, retry } = useAsyncData(() => travelService.getServices())
  → status === 'loading'  → <LoadingState variant="carousel" />
  → status === 'empty'    → <EmptyState message={strings.NoServices} />
  → status === 'error'    → <ErrorState onRetry={retry} />
  → status === 'success'  → <Carousel items={data} renderItem={s => <TravelServiceCard .../>} />

TravelService.getServices()
  → cache.getOrAdd('travelServices', ttl, () =>
        sp.web.lists.getByTitle('TH_TravelServices').items
          .select(<explicit fields>)
          .filter("IsActive eq 1 and (window)")
          .orderBy('DisplayOrder')
          .top(50)())
  → maps raw items → ITravelService[]  (URL validation, date parsing here)
```

The component receives `ITravelService[]`. It never sees a SharePoint field name,
an OData query, or a PnPjs object.

## 4. Folder structure (target, created incrementally by phase)

```
src/
├── models/                         # Phase 2 – pure interfaces, no logic
│   ├── IHeroBanner.ts
│   ├── ITravelService.ts
│   ├── IGlobalNav.ts
│   ├── … one per entity …
│   ├── ITravelHubConfiguration.ts
│   └── index.ts                    # barrel re-export
│
├── services/                       # Phase 2 base, then per section
│   ├── base/
│   │   ├── SharePointService.ts    # SPFI factory + shared query helpers
│   │   ├── ICache.ts
│   │   ├── MemoryCache.ts          # in-memory TTL cache (per page load)
│   │   ├── ServiceKeys.ts          # ServiceKey<T> constants
│   │   └── Logger.ts               # thin wrapper over @microsoft/sp-core-library Log
│   ├── ConfigurationService.ts
│   ├── HeroBannerService.ts
│   ├── TravelService.ts
│   ├── NewsService.ts
│   ├── EventService.ts
│   ├── TravelTipsService.ts
│   ├── GlobalNavigationService.ts
│   ├── QuickPulseService.ts
│   ├── TestimonialService.ts
│   ├── ITravelSpendService.ts      # interface only
│   ├── SharePointTravelSpendService.ts  # one implementation
│   ├── TravelTeamService.ts
│   └── FooterService.ts
│
├── common/                         # Phase 2–3 – reusable, presentational
│   ├── components/
│   │   ├── Button/  IconButton/  Card/  SectionHeader/  Carousel/
│   │   ├── LoadingState/  EmptyState/  ErrorState/  Skeleton/
│   │   ├── ImageWithFallback/  ExternalLink/  Modal/  Badge/  Rating/
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useAsyncData.ts         # loading/success/empty/error state machine
│   │   ├── useCarousel.ts          # index, autoplay, pause, keyboard, swipe
│   │   ├── useReducedMotion.ts
│   │   └── useServices.ts          # pulls service instances from context
│   ├── utils/
│   │   ├── urlValidation.ts        # allow-list http/https/mailto/tel
│   │   ├── dateFormatting.ts       # locale + optional Hijri
│   │   ├── sanitize.ts             # rich-text handling
│   │   └── array.ts
│   ├── context/
│   │   └── ServiceContext.tsx      # React context carrying all services + config
│   └── styles/
│       ├── _tokens.scss            # --full-* design tokens (single source)
│       ├── _typography.scss
│       ├── _breakpoints.scss
│       └── _mixins.scss
│
└── webparts/travelHub/
    ├── TravelHubWebPart.ts         # EXISTING – becomes composition root
    ├── TravelHubWebPart.manifest.json  # EXISTING
    ├── loc/                        # EXISTING – add strings per phase
    └── components/
        ├── TravelHub.tsx           # EXISTING – thin orchestrator only
        ├── ITravelHubProps.ts      # EXISTING – extend with services/config
        ├── TravelHub.module.scss   # EXISTING – imports _tokens, page grid only
        └── sections/               # NEW – one folder per section
            ├── HeroBanner/
            │   ├── HeroBanner.tsx
            │   ├── HeroCarousel.tsx
            │   ├── HeroQuickLinks.tsx      # NOT part of the carousel
            │   ├── HeroBanner.module.scss
            │   └── index.ts
            ├── TravelServicesCarousel/
            │   ├── TravelServicesCarousel.tsx
            │   ├── TravelServiceCard.tsx
            │   └── …
            ├── TravelUpdatesSection/
            │   ├── TravelUpdatesSection.tsx
            │   ├── TravelNewsCard.tsx
            │   ├── UpcomingEventsCard.tsx
            │   ├── TravelTipsCard.tsx
            │   └── …
            ├── TravelerEngagementSection/
            │   ├── TravelerEngagementSection.tsx
            │   ├── QuickPulseCard.tsx
            │   ├── TravelerTestimonialsCarousel.tsx
            │   └── …
            ├── TravelInsightsSection/
            │   ├── TravelInsightsSection.tsx
            │   ├── DepartmentTravelSpendCard.tsx
            │   ├── GreenTravelCard.tsx
            │   └── …
            ├── TravelTeamSection/
            │   ├── TravelTeamSection.tsx
            │   ├── TravelTeamCard.tsx
            │   └── …
            └── TravelHubFooter/
                ├── TravelHubFooter.tsx
                ├── FooterColumn.tsx
                └── …
```

Rationale for `src/models`, `src/services`, `src/common` at the **src root**
(not under `webparts/travelHub`): they are web-part-agnostic and reusable if a
second web part (e.g. a "Travel Team" full-page part) is added later. Section
components live under the web part because they are specific to this page.

## 5. Component hierarchy

```
TravelHub (orchestrator)
├── HeroBanner
│   ├── HeroCarousel ─ uses <Carousel> + <ImageWithFallback> / video element
│   └── HeroQuickLinks ─ Help Desk link, Travel Care 24/7 link, supporting message
├── TravelServicesCarousel ─ <SectionHeader> + <Carousel> of <TravelServiceCard>
├── TravelUpdatesSection ─ <SectionHeader> per card
│   ├── TravelNewsCard ─ featured item + list items, "View All"
│   ├── UpcomingEventsCard ─ date-block rows, "View All"
│   └── TravelTipsCard ─ icon rows, "View All"
├── TravelerEngagementSection
│   ├── QuickPulseCard ─ question + <Rating>-style options + submit + confirmation
│   └── TravelerTestimonialsCarousel ─ <Carousel> of testimonial cards
├── TravelInsightsSection
│   ├── DepartmentTravelSpendCard ─ gated; <ErrorState variant="forbidden"> or summary
│   └── GreenTravelCard ─ content + image with CSS overlay
├── TravelTeamSection ─ <SectionHeader> + grid of <TravelTeamCard>, "View All"
└── TravelHubFooter ─ up to 6 <FooterColumn>, brand block, legal line
```

## 6. Dependency injection / service wiring

- `TravelHubWebPart.onInit()` creates a single **`SPFI`** instance
  (`spfi().using(SPFx(this.context))`) and constructs every service, passing the
  `SPFI`, an `ICache` instance, and the `Logger`.
- A `ServiceRegistry` object `{ config, heroBanner, travelServices, news, … }`
  is passed into `TravelHub.tsx` via `ITravelHubProps` and published through
  **`ServiceContext`** so any descendant can call `useServices()`.
- Services are **interfaces first** (`IHeroBannerService`), concrete classes
  second. This makes unit testing (mock services) and future data-source swaps
  (e.g. `PowerBiTravelSpendService`) drop-in.
- `ConfigurationService` is resolved **once** in `onInit()`; its result
  (`ITravelHubConfiguration`) is passed down as data, not re-fetched per section.

## 7. Rendering & state rules

- Each section owns exactly one `useAsyncData` call (or a small number when it
  genuinely aggregates lists, e.g. Travel Updates loads news + events + tips in
  parallel with `Promise.all`).
- Four visual states are mandatory everywhere: **loading (skeleton) / success /
  empty / error**. No blank areas on failure.
- `React.memo` / `useMemo` / `useCallback` are used only where a measured or
  obvious re-render problem exists (carousels, large lists). Not by default.
- Motion respects `prefers-reduced-motion` via `useReducedMotion`; autoplay
  carousels stop when reduced motion is requested or the tab is hidden.

## 8. Styling architecture

- `src/common/styles/_tokens.scss` declares the `--full-*` CSS custom properties
  on `:root` (scoped to a wrapper class to avoid leaking into the host page).
- Every `*.module.scss` imports `_tokens`, `_typography`, `_breakpoints`,
  `_mixins` and references `var(--full-…)` — **never raw hex**.
- SPFx theme tokens (`[theme:bodyText]`) are still honoured for host-theme
  compatibility, layered under the brand tokens.
- Breakpoints: mobile `< 640px`, tablet `640–1024px`, desktop `> 1024px`
  (final values in `_breakpoints.scss`, overridable via config for card counts).

## 9. Third-party dependencies

| Package | Why | When |
| --- | --- | --- |
| `@pnp/sp` (+ `@pnp/core`, `@pnp/queryable`) `4.21.0` (exact) | Standard, typed SharePoint data access; removes hand-rolled REST and `SPHttpClient` boilerplate; supports batching and field selection cleanly. v4.21.0 is the current v4 line, compatible with SPFx 1.22 / Node 22 / TS 5.8. **Installed in Phase 2.** Imported only by `services/base/SharePointService.ts`; feature services depend on that class via `import type` so unit tests don't load PnPjs. | ✅ Phase 2 |
| _(none else planned)_ | Fluent UI v8 is already present from the scaffold and is used sparingly (icons, a few primitives). No component kit, no date library (native `Intl` + a tiny Hijri helper), no carousel library (custom `useCarousel`). | — |

Any further dependency requires a written justification in a phase plan before
`npm install`.
