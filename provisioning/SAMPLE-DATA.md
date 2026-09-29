# TravelHub – Sample data & field guide

## Load the sample data

`travelhub-sample-data.js` fills every `TH_*` list with demo content that matches
the mockup. **Run `travelhub-provision.js` first** (lists + fields must exist).

1. Open a page on the target site (e.g. `.../sites/TravelHub`).
2. `F12` → Console. Set `CONFIG.TARGET_WEB_URL` if auto-detect is wrong.
3. Paste the whole file → Enter. Read the **SUMMARY**.

Options (top of the file):

| Option | Default | Effect |
| --- | --- | --- |
| `RESET` | `false` | Delete every item in the `TH_*` content lists first, then reload. Structure is untouched. |
| `USE_PLACEHOLDER_IMAGES` | `true` | Use `picsum.photos` / `pravatar.cc` placeholder URLs. Set `false` to leave image columns blank (the web part shows a fallback icon), then replace with URLs from **Travel Hub Images**. |

Without `RESET`, a list that already has items is skipped, so it is safe to
re-run. To reload clean, set `RESET: true`.

> The **Department Travel Spend** card shows "access restricted" until your
> account is in the **TravelHub Spend Viewers** group — that is by design.

---

## What each field is for

Legend: **R** = the section needs this to render the item · everything else is optional.

### TH_SiteConfiguration — one row per setting
| Field | Purpose | Example |
| --- | --- | --- |
| Title **(R)** | the config **key** (renamed "Key") | `hero.intervalSeconds` |
| ConfigValue **(R)** | the value, as text; code parses it by type | `6` |
| ValueType | `string` / `number` / `boolean` / `json` — editor aid | `number` |
| Category | grouping for editors only | `Hero` |
| IsActive **(R)** | `No` = ignore this row, fall back to the built-in default | `Yes` |
| Notes | free-text guidance for editors | — |

Full key list: [../docs/CONFIGURATION.md](../docs/CONFIGURATION.md). The loader seeds all defaults.

### TH_HeroBanners — rotating hero slides
| Field | Purpose | Example |
| --- | --- | --- |
| Title | headline shown over the slide | `Plan smarter with SAP Concur` |
| Description | supporting sentence under the headline | `Book, approve and expense in one workflow.` |
| MediaType **(R)** | `Image` or `Video` | `Image` |
| ImageUrl **(R for Image)** | desktop image (hyperlink → a file in Travel Hub Images) | `https://…/hero1.jpg` |
| MobileImageUrl | portrait image for phones; falls back to ImageUrl | `https://…/hero1-m.jpg` |
| VideoUrl **(R for Video)** | MP4/stream URL; plays muted, no sound-autoplay | `https://…/hero.mp4` |
| AccessibilityText **(R)** | alt text describing the media | `Airport terminal at sunset` |
| DisplayOrder | slide order, low → first | `1` |
| AutoPlay | per-slide autoplay preference | `Yes` |
| DurationSeconds | seconds this slide stays before advancing (3–30) | `6` |
| IsActive **(R)** | `No` hides the slide | `Yes` |
| StartDate / EndDate | optional visibility window | — |

The two hero quick links ("Help Desk", "Travel Care 24/7") are **not** here — they
come entirely from `TH_SiteConfiguration`:

| Key | Purpose |
| --- | --- |
| `hero.quickLinks.layout` | `inline` (two cards on one row, default) or `stack` (narrow single column) |
| `hero.quickLink.helpDesk.url` / `.travelCare.url` | destination |
| `hero.quickLink.helpDesk.type` / `.travelCare.type` | `page` (normal link, opens in a new tab) or `image` (URL is an image — opens in an **in-app viewer** with zoom, so QR codes can be scanned and the library URL is never shown in the address bar). Defaults: Help Desk `page`, Travel Care `image` |
| `hero.quickLink.*.openInNewTab` | new tab for `type: page` (default `true`); ignored for `image` |
| `hero.quickLink.*.title` / `.description` / `.badgeText` | card text |

Set `hero.quickLink.travelCare.url` to your Travel Care poster image (a file in
**Travel Hub Images**) and `hero.quickLink.helpDesk.url` to the help-desk page.
A link with no valid URL renders as a dimmed, non-clickable card.

### TH_TravelServices — "Explore Our Travel Services" cards
| Field | Purpose | Example |
| --- | --- | --- |
| Title **(R)** | card heading | `Business Travel` |
| Description **(R)** | 1–3 lines under the heading | `Book flights, hotels and transport…` |
| ImageUrl | card image (top of the card) | `https://…/svc-business.jpg` |
| Icon | Fluent UI icon name for the coloured chip | `Airplane` |
| IconBackgroundColor | chip colour — `#rrggbb` or `--full-primary` / `--full-secondary` | `#04253c` |
| LinkUrl **(R)** | where the card action goes | `#` or `https://…` |
| LinkType | `Internal` or `External` | `Internal` |
| LinkText | the action label | `Learn More` / `Explore Offers` |
| OpenInNewTab | open the link in a new tab | `No` |
| DisplayOrder | card order | `1` |
| IsActive **(R)** | `No` hides the card | `Yes` |
| StartDate / EndDate | optional visibility window | — |

Icon names: see the Fluent UI icon list (`Airplane`, `Suitcase`, `Financial`,
`Cake`, `Group`, `DocumentApproval`, `CompassNW`, …).

### TH_TravelNews — Travel News & Articles
| Field | Purpose | Example |
| --- | --- | --- |
| Title **(R)** | article title | `Explore Saudi Arabia: new destinations` |
| Description **(R)** | short summary | `Discover newly opened Red Sea destinations…` |
| ImageUrl | thumbnail / featured image | `https://…/news1.jpg` |
| PublishDate **(R)** | date shown + used for ordering | `2026-08-20` |
| LinkType **(R)** | `Internal` (SPO page), `External` (other site), `OnPremReference` (legacy farm — link only, shows a "legacy site" hint) | `Internal` |
| TargetUrl **(R)** | the article URL | `#` or `https://…` |
| Category | badge on the featured card | `Policy` |
| IsFeatured | hint for the large lead card (the first item is the lead regardless) | `Yes` |
| OpenInNewTab | new tab | `No` for Internal |
| DisplayOrder | order after the featured item | `2` |
| IsActive **(R)** | `No` hides it | `Yes` |

### TH_TravelEvents — Upcoming Events (only today/future show)
| Field | Purpose | Example |
| --- | --- | --- |
| Title **(R)** | event name | `Flynas partner roadshow` |
| Description | one line under the title | `Meet our airline partner…` |
| EventDate **(R)** | date; **past dates are hidden** | `2026-09-15` |
| StartTime / EndTime | display strings | `10:00` / `11:30` |
| Location | venue / "Online (Teams)" | `Auditorium A` |
| Category | badge | `Training` |
| ImageUrl | small thumbnail | `https://…/evt.jpg` |
| RegistrationUrl | makes the title a link | `#` |
| DisplayOrder | tiebreaker within the same date | `1` |
| IsActive **(R)** | `No` hides it | `Yes` |

### TH_TravelTips — Travel Tips & Insights
| Field | Purpose | Example |
| --- | --- | --- |
| Title **(R)** | the tip text | `Book early to access better rates` |
| Description | optional second line | — |
| Icon | Fluent icon for the row | `CompassNW` |
| Category | grouping (not shown yet) | `General` |
| LinkUrl | makes the tip a link | `#` |
| DisplayOrder | order | `1` |
| IsActive **(R)** | `No` hides it | `Yes` |

---

## Phase 7–10 + navigation lists

All of these are live (not "future phase" placeholders) — every one is read by
a real section or in-app screen on the home page.

| List | Renders in | Key fields |
| --- | --- | --- |
| `TH_QuickPulseQuestions` / `TH_QuickPulseOptions` / `TH_QuickPulseResponses` | Quick Pulse card + its Submit/Results screens | Question (Title); Options: Title, **QuestionId** (lookup), Icon, OptionValue (5→1), DisplayOrder; Responses are written by the web part — do not edit by hand |
| `TH_TravelerTestimonials` | "What Our Travellers Say" carousel + the View All / Submit Feedback screens | Title (person name), Rating (1–5), Comment, **Category** (free-text tag, e.g. "Business Travel"/"Travel Care"), Designation, Department, Location, ProfileImage, PersonInfoLine (optional override for the sub-line), DisplayOrder. Rows submitted through the web part's "Submit Feedback" screen land here with `IsActive = No` — **review and flip to Yes to publish them** |
| `TH_DepartmentTravelSpend` | Department Travel Spend card | Department (Title), Period, Currency (ISO code), TotalSpend / AirSpend / HotelSpend / GroundTransportSpend / BookingSpend, DashboardUrl — **display only, no maths in the web part** |
| `TH_GreenTravel` | Green Travel card | Title, Description, **Points** (one bullet per line), ImageUrl, LinkUrl, LinkText — one active record |
| `TH_TravelTeam` | Meet the Travel Team | Name (Title), Designation, Department, Specialization, ProfileImage, Email (→ `mailto:` only), Phone (→ `tel:` only), Location, DisplayOrder |
| `TH_FooterColumns` / `TH_FooterLinks` | Footer | Column: Title, DisplayOrder. Link: Title, **ColumnId** (lookup), Url, Icon, OpenInNewTab, DisplayOrder |
| `TH_GlobalNavigation` | Global nav bar (admin-added tabs only — see note below) | Title, Url, Kind (`App` same-tab / `External` new-tab), DisplayOrder |
| `TH_PolicyPages` | Travel Policy landing page + every detail page (one adaptive template) | Title, **Slug** (routing key), ParentSlug/ParentTitle (breadcrumb), Hero\* fields, InfoBannerText/NoteBannerText, Cta\* fields, ClosingBanner\* fields, NeedHelp\* fields |
| `TH_PolicyCards` | Content blocks on a `TH_PolicyPages` row | Title, **PageId** (lookup), **Kind** (`Category`/`Info`/`Highlight`/`Rule`/`HelpStep`), Number, Icon, IconColor, Description, SubPoints, TargetSlug (internal nav) or LinkUrl/LinkText (external), DisplayOrder |

**The global nav bar is not fully driven by `TH_GlobalNavigation`.** Most of its
tabs come from elsewhere so there's one source of truth per link:

- **Home** is always first — it's how a visitor gets back to the hub from
  any sub-screen. Not configurable, not stored anywhere.
- One tab per active `TH_TravelServices` row (Business Travel, Personal
  Travel, SAP Concur, Catering Services, Meetings & Events, …). Unlike that
  row's own card on the home page, the nav tab does **not** follow its
  `LinkUrl` — it opens an in-app placeholder page reusing that row's
  title/description/icon/image (`ServicePageScreen`; content/layout still
  TBD — DEMO-READINESS.md §7). Add/edit/reorder services there, not in
  `TH_GlobalNavigation`, to change these tabs.
- The "Travel Policy" row among those services becomes the real in-app
  Travel Policy tab automatically — you don't need (and shouldn't add) a
  separate row for it anywhere.
- The Help Desk / Travel Care links come from `TH_SiteConfiguration`
  (`hero.quickLink.*`), same as the hero cards — labelled "Help Desk" in the
  nav specifically (the hero card keeps its full configured title). Travel
  Care opens the same in-app image viewer the hero card does when its
  `type` is `image`, never a raw navigation to the file.
- `TH_GlobalNavigation` is **only** for extra tabs beyond the above (the
  sample data adds one placeholder example, "RSG Intranet" → `#`). Adding a
  row here with the same title as an existing Travel Service or the Travel
  Policy tab produces a **duplicate** tab — edit the Travel Service (or the
  Travel Policy landing page) instead.

---

## Editing by hand

Every list opens in the normal SharePoint UI (Site Contents → the list). For a
Hyperlink field (`ImageUrl`, `LinkUrl`, …) paste the URL into the **Address**
box. For a lookup field (`QuestionId`, `ColumnId`) pick the parent item from the
dropdown. Reload the TravelHub page after edits — content is cached 2–5 minutes.
