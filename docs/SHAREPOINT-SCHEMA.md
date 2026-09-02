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
| Icon | Single line (Fluent icon name or asset key) |
| IconBackgroundColor | Single line (hex or token name) |
| LinkUrl | Hyperlink |
| LinkType | Choice (`Internal`, `External`) |
| LinkText | Single line |
| OpenInNewTab | Yes/No |
| DisplayOrder | Number |
| IsActive | Yes/No |
| StartDate / EndDate | DateTime |

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
| Designation | Single line |
| Department | Single line |
| Location | Single line |
| PersonInfoLine | Single line (optional explicit override) |
| DisplayOrder | Number |
| IsActive | Yes/No |

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

Admin-added tabs only — shown above the hero banner alongside 3 always-present
built-in tabs (Our Services, and the same Help Desk / Travel Care links
configured on the hero quick links) that don't need a row here. See
GlobalNavigationService.ts and CONFIGURATION.md.

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
