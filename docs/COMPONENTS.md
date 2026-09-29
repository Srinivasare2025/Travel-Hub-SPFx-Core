# TravelHub – Component Catalogue

## What this is

A register of every React component the solution will contain, its single
responsibility, its props contract, and which layer it belongs to. Use it to
check whether something already exists **before** creating a new component
(project rule: reuse, do not duplicate).

Legend for layer: **C** = common/presentational, **S** = section, **P** = part
(sub-component of a section), **O** = orchestrator.

---

## 1. Common component library (`src/common/components`) — layer C

These are pure, presentational, SharePoint-unaware, and reused everywhere.

| Component | Responsibility | Key props (indicative) |
| --- | --- | --- |
| `Button` | Primary/secondary/tertiary action button | `variant`, `onClick`, `href?`, `disabled`, `iconAfter?`, `ariaLabel?` |
| `IconButton` | Icon-only control (carousel prev/next, close) | `icon`, `ariaLabel` (required), `onClick`, `size` |
| `Card` | Surface with border/radius/shadow + optional media slot | `as?`, `media?`, `padding`, `interactive?`, `children` |
| `SectionHeader` | Section title + optional "View All" link on the right | `title`, `viewAll?: { text, url, openInNewTab }`, `headingLevel` |
| `Carousel` | Generic, accessible, responsive slider. Owns nothing about data. | `items`, `renderItem`, `visibleCards: Responsive<number>`, `autoPlay?`, `intervalMs?`, `loop?`, `ariaLabel`, `showDots`, `showArrows` |
| `LoadingState` | Skeleton placeholder matched to a layout variant | `variant: 'carousel' \| 'list' \| 'card' \| 'hero' \| 'grid'`, `count?` |
| `Skeleton` | Single shimmering block primitive | `width`, `height`, `radius`, `circle?` |
| `EmptyState` | Friendly "nothing here yet" panel | `message`, `icon?`, `action?` |
| `ErrorState` | Friendly failure panel with retry; `forbidden` variant for access-denied | `variant: 'error' \| 'forbidden'`, `message?`, `onRetry?` |
| `ImageWithFallback` | `<img>` with `loading="lazy"`, `srcset`/mobile source, error fallback, required `alt` | `src`, `mobileSrc?`, `alt` (required), `fallbackSrc?`, `aspectRatio?` |
| `ExternalLink` | `<a>` that validates the URL (allow-list) and sets `rel="noopener noreferrer"` for new tabs; renders plain text if URL rejected | `href`, `openInNewTab?`, `children` |
| `Modal` | Accessible dialog: focus trap, ESC, backdrop click, body-scroll lock, focus restored on close. Rendered in place (no portal) so tokens apply. Used by the hero image viewer, and later "View Previous Results" | `isOpen`, `onDismiss`, `title`, `hideHeader?`, `size?: 'md'\|'lg'\|'fullscreen'`, `children` |
| `ImageLightbox` | Views an image inside the app (fullscreen `Modal` + fit/actual-size toggle). Used for the Travel Care poster so viewers can scan QR codes without the raw file URL landing in the address bar | `isOpen`, `onClose`, `src`, `alt`, `title?` |
| `Badge` | Small status/category pill (e.g. event category, "24/7", "Authorised Access") | `text`, `tone: 'gold' \| 'navy' \| 'muted' \| 'alert'` |
| `Rating` | Star rating display + optional input mode | `value`, `max?`, `readOnly?`, `onChange?`, `ariaLabel` |

### Common hooks (`src/common/hooks`)

| Hook | Responsibility |
| --- | --- |
| `useAsyncData<T>(loader, deps)` | Runs an async loader; returns `{ status: 'idle'\|'loading'\|'success'\|'empty'\|'error', data, error, retry }`. `empty` when the resolved array is length 0. Cancels on unmount. |
| `useCarousel(opts)` | Active index, next/prev/goTo, autoplay with pause-on-hover / pause-on-focus / pause-on-tab-hidden / pause-on-reduced-motion, keyboard (arrows/Home/End), pointer swipe. |
| `useReducedMotion()` | Boolean from `matchMedia('(prefers-reduced-motion: reduce)')`. |
| `useServices()` | Reads the `ServiceRegistry` + `ITravelHubConfiguration` from `ServiceContext`. |

### Common utils (`src/common/utils`)

| Util | Responsibility |
| --- | --- |
| `isSafeUrl(url, allow?)` / `sanitizeUrl(url)` | Allow-list `https:`, `http:`, `mailto:`, `tel:` (relative `/` allowed for internal). Rejects `javascript:`, `data:`, `vbscript:`. Returns `undefined` if unsafe. |
| `formatDate(date, locale, opts)` / `formatHijri(date, locale)` | Gregorian via `Intl.DateTimeFormat`; Hijri via `Intl` `islamic-umalqura` calendar. Hijri shown only when config flag on. |
| `stripHtml(html)` / `renderRichText(html)` | Default is plain-text. Rich text only rendered through a sanitiser allow-list; `dangerouslySetInnerHTML` isolated to one audited helper. |

---

## 2. Orchestrator — layer O

| Component | Responsibility |
| --- | --- |
| `TravelHub` | Reads `ITravelHubConfiguration`. Renders `GlobalNav` above the page, then each section in mock order, wrapped in an error boundary, only when `config.sections.<name>.isVisible`. Provides `ServiceContext`. Contains **no** data calls, **no** business logic, **no** section markup. |
| `GlobalNav` | Not a "section" (not gated by `config.sections`). Loads `IGlobalNavItem[]`: a "Home" tab (the only way back to the hub from a sub-screen), one tab per active `TH_TravelServices` row (Business Travel, Personal Travel, SAP Concur, …, each opening its own `ServicePageScreen`; "Travel Policy" among them opens the real Travel Policy landing page instead), the Help Desk/Travel Care hero quick links (Travel Care's `type: image` quick link opens the same in-app `ImageLightbox` the hero card does, never a raw navigation to the image file), plus admin-added rows from `TH_GlobalNavigation`. |
| `TravelHubErrorBoundary` | Class error boundary; a thrown section renders `<ErrorState>` instead of blanking the page. |

---

## 3. Section components (`.../components/sections`) — layers S / P

### 3.1 HeroBanner — S
| Component | Layer | Responsibility |
| --- | --- | --- |
| `HeroBanner` | S | Loads `IHeroBanner[]` (active, in window) + hero quick-link config. Composes carousel + quick links + supporting message. |
| `HeroCarousel` | P | **Only** the rotating media/title/description. Image slides: `Carousel` + `ImageWithFallback` (`object-fit: cover`), advancing on the shared `hero.intervalSeconds` timer. Video slides: `object-fit: contain` (never cropped), muted by default with an on-video mute/unmute toggle, plays only while the slide is active, and advances the carousel on the video's own `ended` event (not a timer) so it always plays out in full — plus a "Watch full video" link that opens the source video in a new tab. |
| `HeroQuickLinks` | P | The two links (Help Desk, Travel Care 24/7) + supporting message. **Explicitly outside** the carousel. Each link independently configured. |

### 3.2 TravelServicesCarousel — S
| Component | Layer | Responsibility |
| --- | --- | --- |
| `TravelServicesCarousel` | S | Loads `ITravelService[]`. `SectionHeader` ("Explore Our Travel Services"). `Carousel` with `visibleCards` from config (`desktop/tablet/mobileVisibleCards`). Prev/next + dots. |
| `TravelServiceCard` | P | Image, icon on coloured background, title, description, action link with arrow. Link behaviour (internal/external/new tab) from data. |

### 3.3 TravelUpdatesSection — S
| Component | Layer | Responsibility |
| --- | --- | --- |
| `TravelUpdatesSection` | S | Three-column layout. Loads news + events + tips in parallel. Each column independent loading/empty/error. |
| `TravelNewsCard` | P | Featured (first) item full-width image + title + description + date + "View details"; remaining items as thumbnail-left rows. `SectionHeader` with "View All". |
| `UpcomingEventsCard` | P | Rows of date block (day + month, localised, optional Hijri) + title + category badge + description + time + location + thumbnail. "View All". |
| `TravelTipsCard` | P | Icon + text rows. Optional per-tip link. "View All". |

### 3.4 TravelerEngagementSection — S
| Component | Layer | Responsibility |
| --- | --- | --- |
| `TravelerEngagementSection` | S | Two-column layout: Quick Pulse (sized to match a Travel News/Article card) + testimonials. Both columns start with the same `SectionHeader` so the two cards line up. |
| `QuickPulseCard` | P | Question + selectable option icons + an optional comment box, submitted in place (no separate screen) - "View All Traveler Survey" still navigates (`NavigationContext`) to the dedicated results screen. Enforces "already responded". Never renders other users' responses. |
| `QuickPulseResultsScreen` | P | **Aggregate** counts only, and only fetched when permitted. |
| `TravelerTestimonialsCarousel` | P | `Carousel` (~3 visible desktop) of testimonial cards: profile image, category tag (`Badge`), `Rating`, comment, name, and a configurable person-info line (see ASSUMPTIONS). "View All Stories" navigates to `ViewAllFeedbackScreen`. |
| `ViewAllFeedbackScreen` | P | Every active testimonial (not just the carousel's page), each card tagged with its category, ending in a "Submit Feedback" button to `SubmitFeedbackScreen`. |
| `SubmitFeedbackScreen` | P | Rating/category/comment/designation/department/location form. Writes to `TH_TravelerTestimonials` with `IsActive = false` — held for moderation, never live immediately. The submitter's name comes from their signed-in identity, not a form field. |

### 3.5 TravelInsightsSection — S
| Component | Layer | Responsibility |
| --- | --- | --- |
| `TravelInsightsSection` | S | Two-column: spend + green travel. |
| `DepartmentTravelSpendCard` | P | Calls `ITravelSpendService`. If not permitted → `ErrorState variant="forbidden"` with the friendly message + "View Travel Dashboard" (external link to `DashboardUrl`). If permitted → summary tiles (Total / Air / Hotel / Ground / Booking) from the model — **no client-side calculation**. |
| `GreenTravelCard` | P | Left content (title, description, bullet points, link). Right image with CSS gradient overlay (source image untouched). |

### 3.6 TravelTeamSection — S
| Component | Layer | Responsibility |
| --- | --- | --- |
| `TravelTeamSection` | S | Loads `ITravelTeamMember[]`. `SectionHeader` ("Meet the Travel Team") + "View All Team Members" → in-app `TravelTeamAllScreen` (`NavigationContext`'s `teamAll` view), same pattern as testimonials' "View All Stories". Renders ~4 on the landing page (`landingPageCount` config). |
| `TravelTeamCard` | P | Two-part card: rectangular rounded-corner photo on the left, name/designation/secondary line/contact icons (`mailto:`/`tel:` only, via `ExternalLink`) on the right. Fixed height so cards stay aligned regardless of how much optional contact info a member has. |
| `TravelTeamAllScreen` | P | Every active team member (`TravelTeamService.getAllTeamMembers()`, uncapped) in a grid of `TravelTeamCard`. |

### 3.7 TravelHubFooter — S
| Component | Layer | Responsibility |
| --- | --- | --- |
| `TravelHubFooter` | S | Loads `IFooterColumn[]` + `IFooterLink[]`. Renders up to six columns, brand block, legal/last-updated line, optional QR. Fully data-driven. |
| `FooterColumn` | P | One column: title + ordered links (`ExternalLink`, icon optional). |

### 3.8 PolicyPages — S
Not one of the mock's original sections — reached via `GlobalNav`'s built-in
"Travel Policy" tab, not `configuration.sections`.

| Component | Layer | Responsibility |
| --- | --- | --- |
| `PolicyPageScreen` | S | One adaptive template for every Travel Policy page (landing page included, via `PolicyService.getPage(slug)`) — breadcrumb (with an optional non-clickable section crumb, e.g. "Explore Policy Information"), hero, info/note banners, an ordered list of `IPolicySection` content blocks, CTA row, "Need Help" (+ its own fixed "Ask HR" step process), closing banner - each rendered only when that page has the corresponding data. An AI-assistant section renders as a static "Coming Soon" placeholder whenever the page has `SuggestedQuestions` set - no service, deferred pending a decision on what it integrates with. |
| `PolicyCardSections` (`PolicySectionBlock` + `CategoryCards`/`InfoCards`/`HighlightCards`/`RuleCards`/`HelpSteps`/`ParagraphBlock`/`TableBlock`/`TabsBlock`/`Callout`/`ImageBlock`/`LinksList`) | P | `PolicySectionBlock` renders one `IPolicySection` by its `layout` (`Paragraph`/`CardsGrid`/`Table`/`Tabs`/`NumberedSteps`/`ProcessSteps`/`Callout`/`ImageBlock`/`LinksList`), picking one of the card-grid visual treatments via `cardVariant` when `layout = CardsGrid`. A `Category`/`Info`/`LinkItem` card navigates in-app via `TargetSlug` (priority) or an external `LinkUrl`. |

### 3.9 ServicePages — S
Not one of the mock's original sections — reached via `GlobalNav`'s per-service
tabs (Business Travel, Personal Travel Offers, SAP Concur, Catering Services,
Meetings & Events, Expense Claim, …), not `configuration.sections`.

| Component | Layer | Responsibility |
| --- | --- | --- |
| `ServicePageScreen` | S | A placeholder landing page reusing one `TH_TravelServices` row's own title/description/icon/image, plus a CTA button from that row's own link if it has one. No dedicated content/layout yet ("future we will decide content and layout") — exists so these tabs go to a real page instead of a dead `#` link. |

---

## 4. Anti-patterns (rejected by review)

- A `TravelHub.tsx` containing section markup or `sp.web.lists...`.
- A component importing a service class directly instead of via `useServices()`.
- A second bespoke carousel/slider implementation.
- Raw `#b89c66` / `#04253c` in a component stylesheet.
- `fetch` / `SPHttpClient` / `sp.web...` inside a `.tsx` render tree.
- `dangerouslySetInnerHTML` outside `common/utils/sanitize.ts`.
- A section with only 3 of the 4 required states (loading/success/empty/error).
