# TravelHub – SharePoint Schema

## What this is

The SharePoint Online lists, libraries and columns that back TravelHub, plus how
they are provisioned. The React solution reads these through the service layer;
the business/admin team maintains the **content** here without developer help.

## Naming & conventions

- Lists are prefixed **`TH_`**. Internal names match display names (no spaces) to
  keep OData queries readable.
- Every content list has: `Title` (repurposed as the primary text where natural),
  `IsActive` (Yes/No, default Yes), `DisplayOrder` (Number), and — where content
  is time-bound — `StartDate` / `EndDate` (DateTime, optional).
- Images are **not** stored as list attachments. They are URLs pointing into the
  `Travel Hub Images` library (or an approved external CDN). This keeps payloads
  small and lets editors reuse assets.
- Lookups use the target list's `Title` where unique, else `Id`.
- Lists are created with **content approval off** by default (turn on per list if
  the business wants an editorial gate — the service already filters by a status
  field if present).

## Provisioning approach

Two supported options, documented in DEPLOYMENT.md:

1. **PnP Provisioning template** (`provisioning/travelhub-template.xml` +
   `applyTemplate` via PnP PowerShell / CLI for Microsoft 365) — **recommended**,
   repeatable across dev/test/prod.
2. Manual creation from the tables below for a quick dev spin-up.

The SPFx package itself does **not** create lists at install time (keeps the
`.sppkg` clean and avoids feature-framework list provisioning). A post-deploy
provisioning step owns schema.

---

## Lists

### `TH_SiteConfiguration`  (key/value)
| Column | Type | Notes |
| --- | --- | --- |
| Title | Single line | the config **key** (e.g. `hero.intervalSeconds`) |
| ConfigValue | Multiple lines (plain) | the value (string; parsed by type in code) |
| ValueType | Choice | `string \| number \| boolean \| json` |
| Category | Choice | `Hero \| Services \| Testimonials \| Team \| Dates \| Sections \| ViewAll \| FeatureFlags \| Brand` |
| IsActive | Yes/No | |
| Notes | Multiple lines | editor guidance |

One row per key. See CONFIGURATION.md for the full key list.

### `TH_HeroBanners`
| Column | Type |
| --- | --- |
| Title | Single line |
| Description | Multiple lines (plain) |
| MediaType | Choice (`Image`, `Video`) |
| ImageUrl | Hyperlink |
| MobileImageUrl | Hyperlink |
| VideoUrl | Hyperlink |
| AccessibilityText | Single line |
| DisplayOrder | Number |
| AutoPlay | Yes/No |
| DurationSeconds | Number (default 6, 3–600) — image slides only; video slides advance on their own end |
| IsActive | Yes/No |
| StartDate | DateTime |
| EndDate | DateTime |

### `TH_TravelServices`
| Column | Type |
| --- | --- |
| Title | Single line |
| Description | Multiple lines (plain) |
| ImageUrl | Hyperlink |
| ImageFit | Choice (`Cover`, `Contain`) - `Cover` (default) crops to fill the card image, right for photography; use `Contain` for a logo/wordmark image (e.g. a partner brand image with text) so it isn't cropped |
| Icon | Single line (Fluent icon name or asset key) |
| IconBackgroundColor | Single line (hex or token name) |
| LinkUrl | Hyperlink |
| LinkType | Choice (`Internal`, `External`) |
| LinkText | Single line |
| OpenInNewTab | Yes/No |
| DisplayOrder | Number |
| IsActive | Yes/No |
| StartDate / EndDate | DateTime |

### `TH_BusinessTravelSteps`
The dedicated Business Travel page's request-to-expense process row (5 cards:
Raise Request, Approval, Book, Travel, Expense). Title = step title.

| Column | Type |
| --- | --- |
| Title | Single line |
| Description | Multiple lines (plain) |
| Number | Number - shown in the small coloured square |
| BackgroundColor | Single line (hex or `--full-*` token name) - the square's background |
| DisplayOrder | Number |
| IsActive | Yes/No |

### `TH_BusinessTravelInfoCards`
The same page's supporting info-card row (e.g. Policy reminders, Useful
Documents, Need further help?). Title = card title.

| Column | Type |
| --- | --- |
| Title | Single line |
| Description | Multiple lines (plain) |
| LinkUrl | Hyperlink |
| LinkText | Single line (e.g. "View") |
| OpenInNewTab | Yes/No |
| DisplayOrder | Number |
| IsActive | Yes/No |

### `TH_TravelNews`
| Column | Type |
| --- | --- |
| Title | Single line |
| Description | Multiple lines (plain) |
| ImageUrl | Hyperlink |
| PublishDate | DateTime |
| LinkType | Choice (`Internal`, `External`, `OnPremReference`) |
| TargetUrl | Hyperlink |
| Category | Choice / Single line |
| IsFeatured | Yes/No |
| OpenInNewTab | Yes/No |
| DisplayOrder | Number |
| IsActive | Yes/No |

> `OnPremReference` = a full absolute URL to an article on the legacy
> on-premises farm. TravelHub **links** to it; it does not migrate or proxy it.

### `TH_TravelEvents`
| Column | Type |
| --- | --- |
| Title | Single line |
| Description | Multiple lines (plain) |
| EventDate | DateTime |
| StartTime | Single line |
| EndTime | Single line |
| Location | Single line |
| Category | Choice / Single line |
| ImageUrl | Hyperlink |
| RegistrationUrl | Hyperlink |
| DisplayOrder | Number |
| IsActive | Yes/No |

### `TH_TravelTips`
| Column | Type |
| --- | --- |
| Title | Single line (the tip) |
| Description | Multiple lines (plain) |
| Icon | Single line |
| Category | Choice / Single line |
| LinkUrl | Hyperlink |
| DisplayOrder | Number |
| IsActive | Yes/No |

### `TH_QuickPulseQuestions`
| Column | Type |
| --- | --- |
| Title | Single line (the question) |
| IsActive | Yes/No |
| StartDate / EndDate | DateTime |
| AllowComments | Yes/No |
| OneResponsePerUser | Yes/No |

### `TH_QuickPulseOptions`
| Column | Type |
| --- | --- |
| Title | Single line (e.g. "Excellent") |
| QuestionId | Lookup → `TH_QuickPulseQuestions` |
| Icon | Single line (emoji/icon key) |
| OptionValue | Number (5..1) |
| DisplayOrder | Number |
| IsActive | Yes/No |

### `TH_QuickPulseResponses`  (restricted — see SECURITY.md)
| Column | Type |
| --- | --- |
| Title | Single line (auto: `{questionId}-{userId}`) |
| QuestionId | Lookup → `TH_QuickPulseQuestions` |
| ResponseValue | Number |
| Comments | Multiple lines (plain) |
| RespondentUpn | Single line (indexed) |
| SubmittedDate | DateTime (default today) |

Permissions: **broken inheritance.** Members get **Contribute-add-only**
(cannot read others' items) via item-level read = "Only their own"; a
`TravelHub Pulse Admins` group gets Read/Full. Author/Editor columns hidden.

### `TH_TravelerTestimonials`
| Column | Type |
| --- | --- |
| Title | Single line (person name) |
| ProfileImage | Hyperlink |
| Rating | Number (1–5) |
| Comment | Multiple lines (plain) |
| Category | Single line — free-text tag shown top-left of the card, e.g. "Business Travel" / "Travel Care" |
| Designation | Single line |
| Department | Single line |
| Location | Single line |
| PersonInfoLine | Single line (optional explicit override) |
| DisplayOrder | Number |
| IsActive | Yes/No — rows submitted through the web part's "Submit Feedback" screen land here as `No`, pending review |

### `TH_DepartmentTravelSpend`  (restricted — optional; may be replaced by Power BI/Concur)
| Column | Type |
| --- | --- |
| Title | Single line (department) |
| Period | Single line (`2024-Q1`) |
| Currency | Single line (ISO 4217) |
| TotalSpend | Currency |
| AirSpend | Currency |
| HotelSpend | Currency |
| GroundTransportSpend | Currency |
| BookingSpend | Currency |
| DashboardUrl | Hyperlink |
| IsActive | Yes/No |

Permissions: broken inheritance; read granted only to
`TravelHub Spend Viewers` (and finance). If TravelHub ultimately reads spend from
Power BI/Concur/API, this list is not created and `ITravelSpendService` uses the
other implementation. **No spend calculation happens in TravelHub.**

### `TH_GreenTravel`
| Column | Type |
| --- | --- |
| Title | Single line |
| Description | Multiple lines (plain) |
| Points | Multiple lines (plain — one bullet per line) |
| ImageUrl | Hyperlink |
| LinkUrl | Hyperlink |
| LinkText | Single line |
| IsActive | Yes/No |

> Decision: bullet points are stored as newline-delimited text in one field, not
> a child list. They are short, always edited together with the parent record,
> and never queried independently — a separate list would add a join for no
> benefit. Revisit only if points need per-item ordering/links.

### `TH_TravelTeam`
| Column | Type |
| --- | --- |
| Title | Single line (name) |
| Designation | Single line |
| Department | Single line |
| Specialization | Single line |
| ProfileImage | Hyperlink |
| Email | Single line |
| Phone | Single line |
| Location | Single line |
| DisplayOrder | Number |
| IsActive | Yes/No |

### `TH_FooterColumns`
| Column | Type |
| --- | --- |
| Title | Single line |
| DisplayOrder | Number |
| IsActive | Yes/No |

### `TH_FooterLinks`
| Column | Type |
| --- | --- |
| Title | Single line |
| ColumnId | Lookup → `TH_FooterColumns` |
| Url | Hyperlink |
| Icon | Single line |
| OpenInNewTab | Yes/No |
| DisplayOrder | Number |
| IsActive | Yes/No |

> Decision: footer columns and links are **two lists** (not one). Columns are a
> small stable set reordered rarely; links are numerous and edited often.
> Splitting keeps editing simple and lets a column exist with zero links during
> setup.

### `TH_GlobalNavigation`
| Column | Type |
| --- | --- |
| Title | Single line — the tab label |
| Url | Hyperlink |
| Kind | Choice (`App`, `External`) — `App` opens in the same tab; `External` always opens in a new tab |
| DisplayOrder | Number |
| IsActive | Yes/No |

Admin-added tabs only — shown above the hero banner alongside 4 always-present
built-in tabs (Our Services, Travel Policy, and the same Help Desk / Travel
Care links configured on the hero quick links) that don't need a row here. See
GlobalNavigationService.ts and CONFIGURATION.md.

### `TH_PolicyPages`
| Column | Type |
| --- | --- |
| Title | Single line — the page name |
| Slug | Single line, indexed — routing key (e.g. `travel-policy`, `travel-entitlement`) |
| ParentSlug / ParentTitle | Single line — breadcrumb parent, denormalised (not a lookup); blank on the landing page |
| ParentSectionLabel | Single line — a non-clickable breadcrumb crumb between the parent and this page's title, e.g. "Explore Policy Information" |
| SuggestedQuestions | Multiple lines (plain) — newline list; the "Ask Policy Assistant" chips shown on this page (blank hides the assistant block) |
| HeroIcon | Single line (Fluent icon name) |
| HeroTitle / HeroSubtitle | Single line |
| HeroDescription | Multiple lines (plain) |
| HeroImageUrl | Hyperlink |
| HeroTagline | Multiple lines (plain) — the italic script-style line |
| InfoBannerText / NoteBannerText | Multiple lines (plain) |
| CtaTitle / CtaLinkText / CtaPrimaryText | Single line |
| CtaDescription | Multiple lines (plain) |
| CtaLinkUrl / CtaPrimaryUrl | Hyperlink |
| ClosingBannerTitle | Single line |
| ClosingBannerDescription | Multiple lines (plain) |
| ClosingBadges | Multiple lines (plain) — newline list, e.g. "Our People" |
| NeedHelpTitle | Single line |
| NeedHelpSupportLabel | Single line — small eyebrow label, e.g. "Contact Travel Services" / "ASK HR" |
| NeedHelpDescription | Multiple lines (plain) |
| NeedHelpEmail | Single line — leave blank to omit (e.g. the benefits page intentionally shows none) |
| DisplayOrder | Number |
| IsActive | Yes/No |

One row per Travel Policy page, landing page included. See `PolicyService.ts`.

### `TH_PolicySections`
| Column | Type |
| --- | --- |
| Title / Subtitle | Single line / Multiple lines (plain) — this content block's own heading, if any |
| PageId | Lookup → `TH_PolicyPages` |
| Layout | Choice (`Paragraph`, `CardsGrid`, `Table`, `Tabs`, `NumberedSteps`, `ProcessSteps`, `Callout`, `ImageBlock`, `LinksList`) — picks the rendering template |
| CardVariant | Choice (`Category`, `Info`, `Highlight`) — only meaningful when `Layout = CardsGrid`; which of the 3 card visual treatments to use |
| Body | Multiple lines (plain) — free text for `Layout = Paragraph`/`Callout`, one paragraph per line |
| Icon | Single line (Fluent icon name) — for `Layout = Callout`/`ImageBlock` |
| ImageUrl | Hyperlink — for `Layout = ImageBlock` |
| DisplayOrder | Number |
| IsActive | Yes/No |

One ordered content block on a page — this is the unit a content owner
adds/reorders/removes to build up a page's body, between the hero and the
CTA/Need Help/closing banner. See `PolicyService.ts` / `PolicyCardSections.tsx`.

### `TH_PolicyTabs`
| Column | Type |
| --- | --- |
| Title | Single line — the tab label, e.g. "Business Travel" |
| SectionId | Lookup → `TH_PolicySections` — the parent `Layout = Tabs` section |
| DisplayOrder | Number |
| IsActive | Yes/No |

One tab of a `Layout = Tabs` section (e.g. Travel Entitlement's "Business
Travel" vs "Business Assignment"); its own cards/tables render inside it via
`TH_PolicyCards.TabId` / `TH_PolicyTables.TabId`.

### `TH_PolicyCards`
| Column | Type |
| --- | --- |
| Title | Single line |
| PageId | Lookup → `TH_PolicyPages` — reserved for the fixed "Ask HR" style `HelpStep` process under a page's Need Help row (not a reorderable content block) |
| SectionId | Lookup → `TH_PolicySections` — this card's parent section (when not inside a tab) |
| TabId | Lookup → `TH_PolicyTabs` — this card's parent tab, if any (takes priority over `SectionId`'s direct placement) |
| Kind | Choice (`Category`, `Info`, `Highlight`, `Rule`, `HelpStep`, `LinkItem`) — one rendering template per kind |
| Number | Number — Rule/HelpStep badge |
| Icon | Single line (Fluent icon name) |
| IconColor | Single line (hex) |
| Description | Multiple lines (plain) |
| SubPoints | Multiple lines (plain) — newline list, e.g. a Rule card's "Seasonal periods include" bullets |
| TargetSlug | Single line — internal navigation to another `TH_PolicyPages` row; takes priority over `LinkUrl` |
| LinkUrl | Hyperlink |
| LinkText | Single line |
| DisplayOrder | Number |
| IsActive | Yes/No |

Repeatable content blocks — the same shape covers policy-category cards,
"Explore Policy Information" tiles, "Key Policy Highlights"/comparison cards,
numbered rule cards, "Ask HR"/process help steps, and link-pill items.

### `TH_PolicyTables`
| Column | Type |
| --- | --- |
| Title | Single line — optional sub-heading, e.g. distinguishing several tables in the same section/tab (e.g. "Air Travel Entitlement" vs "Accommodation Entitlement") |
| SectionId | Lookup → `TH_PolicySections` — this table's parent section (when not inside a tab) |
| TabId | Lookup → `TH_PolicyTabs` — this table's parent tab, if any |
| ColumnHeaders | Multiple lines (plain) — one column header per line |
| DisplayOrder | Number |
| IsActive | Yes/No |

A simple data table for `Layout = Table` (or inside a `Layout = Tabs`
section/tab) — several may stack under the same section/tab. See
`TH_PolicyTableRows` for the actual cell data.

### `TH_PolicyTableRows`
| Column | Type |
| --- | --- |
| TableId | Lookup → `TH_PolicyTables` |
| CellValues | Multiple lines (plain) — one cell value per line, matching the parent table's `ColumnHeaders` order |
| DisplayOrder | Number |

One row of a `TH_PolicyTables` table.

---

## Libraries

| Library | Purpose | Notes |
| --- | --- | --- |
| `Travel Hub Images` | All imagery referenced by list `*Url` columns | Enable "Get link" / organisation sharing; consider a `Category` column for editor filtering. Recommend image guidelines (see PERFORMANCE.md). |
| `Travel Hub Documents` | Policy PDFs, posters (e.g. Green Travel poster), guides | Linked from services/tips/news |
| `Travel Hub Videos` | Hero videos (if not using Stream) | Large files; prefer Microsoft Stream (SharePoint) embed URLs where possible |

---

## Content types (optional but recommended)

Create a `TravelHub Content` parent CT with the shared columns
(`IsActive`, `DisplayOrder`, `StartDate`, `EndDate`) and derive per-list CTs.
Benefits: consistent columns, easier future site-column governance. Not required
for the code to work — the services query by internal name.

---

## Indexing

Add indexed columns on lists expected to grow past a few hundred items:
`TH_TravelNews.PublishDate`, `TH_TravelEvents.EventDate`,
`TH_QuickPulseResponses.RespondentUpn`, and `IsActive` on the same lists.
Keeps `filter`/`orderBy` under the list view threshold.

---

## What NOT to create

- No list per hero quick link (two rows in `TH_SiteConfiguration` or a tiny
  `TH_HeroQuickLinks` list — decision deferred to Phase 4; default is config
  rows).
- No separate "categories" lists unless the business needs managed category
  governance — `Choice` columns suffice initially.
- No audit/log list — use SPFx `Log` + tenant audit.
