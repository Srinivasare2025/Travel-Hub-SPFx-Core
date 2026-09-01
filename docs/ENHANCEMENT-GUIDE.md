# TravelHub – Enhancement Guide

## What this is and why it exists

TravelHub is built so that **most changes are content or configuration, not
code**. This guide is the recipe book: for each likely future change it states
who does it, whether a deploy is needed, and the exact steps. If a change you
need is not here, follow the "General rules" at the end.

Legend: 🟢 no code / no deploy · 🟡 config + content · 🔵 code + deploy.

---

## Content changes — 🟢 (business / admin, no developer)

| Change | Where | Steps |
| --- | --- | --- |
| Add / edit / retire a **Travel Service** card | `TH_TravelServices` | New item; set `Title`, `Description`, `ImageUrl` (upload to *Travel Hub Images* first), `Icon`, `IconBackgroundColor`, `LinkUrl`, `LinkType`, `OpenInNewTab`, `DisplayOrder`, `IsActive = Yes`. Retire = `IsActive = No` (keeps history). |
| Add a **Travel Policy / article** | `TH_TravelNews` | New item; `LinkType = Internal/External/OnPremReference`, `TargetUrl`, `PublishDate`, `IsFeatured` for the big card, `DisplayOrder`. |
| Add an **Event** | `TH_TravelEvents` | New item; `EventDate` (required), `Category`, `Location`, `RegistrationUrl`. Past events drop off automatically. |
| Add a **Travel Tip** | `TH_TravelTips` | New item; `Title` (the tip), `Icon`, optional `LinkUrl`, `DisplayOrder`. |
| Add / reorder a **Team member** | `TH_TravelTeam` | New item; `ProfileImage`, `Designation`, `Specialization`, `Email`, `Phone`, `DisplayOrder`. Landing page shows the first `team.landingPageCount`. |
| Change the **Hero banner** | `TH_HeroBanners` | Add/disable slides; set `MediaType`, `ImageUrl`/`MobileImageUrl`/`VideoUrl`, `AccessibilityText` (required), `DurationSeconds`, date window. |
| Add / change a **footer link** | `TH_FooterLinks` (+ `TH_FooterColumns` for a new column) | New link row; set `ColumnId`, `Url`, `Icon`, `DisplayOrder`, `OpenInNewTab`. |
| Add / change a **testimonial** | `TH_TravelerTestimonials` | New item; `Rating` 1–5, `Comment`, `ProfileImage`, `Designation`, `Location`, or set `PersonInfoLine` to control the sub-line text exactly. |
| Update **Green Travel** content | `TH_GreenTravel` | Edit the active row; one bullet per line in `Points`. |

Reload the page after edits (content cache is 2–5 min).

---

## Configuration changes — 🟡 (admin, no developer, no deploy)

All via a row in `TH_SiteConfiguration` (`Title` = key). See CONFIGURATION.md for
the full catalogue.

| Want to… | Key(s) |
| --- | --- |
| Change how many service cards show | `services.desktopVisibleCards` / `tabletVisibleCards` / `mobileVisibleCards` |
| Change hero autoplay speed / turn autoplay off | `hero.intervalSeconds`, `hero.autoPlay` |
| Change testimonials speed / visible count | `testimonials.intervalSeconds`, `testimonials.desktopVisibleCards` |
| Repoint a "View All" link | `viewAll.news.url`, `viewAll.events.url`, `viewAll.tips.url`, `viewAll.testimonials.url` (and `.text`) |
| Hide a whole section temporarily | `sections.<key>.isVisible = false` |
| Rename a section heading | `sections.<key>.title` |
| Change the person-info line format for testimonials | `testimonials.personInfoTemplate` (e.g. `{designation}, {department}`) |
| Turn Hijri dates on | `dates.showHijri = true` |
| Change display locale | `dates.locale` |
| Change the brand name shown in copy/footer | `brand.name` |
| Change the Quick Pulse confirmation text | `quickPulse.confirmationMessage` |
| Point the spend "View Dashboard" button somewhere | `spend.dashboardUrl` |

> Section visibility is a display switch only — never a security control.

---

## Common developer enhancements — 🔵 (code + deploy)

### Add a brand-new section
1. `src/models/IMyThing.ts` + export from `models/index.ts` (follow DATA-MODEL
   conventions).
2. `src/services/MyThingService.ts` + `IMyThingService`; register it in
   `TravelHubWebPart.onInit()` and `ServiceContext`. Add to the first-load
   batch or defer it (PERFORMANCE.md).
3. `.../components/sections/MySection/` — section component using `useServices()`
   + `useAsyncData`, composing common components, with all four states.
4. Add `sections.mySection.isVisible` (default as agreed) + any keys to
   `ConfigurationService` DEFAULTS + `ITravelHubConfiguration` + CONFIGURATION.md.
5. Render it in `TravelHub.tsx` in the right order, guarded by `isVisible`.
6. `TH_MySection` list in SHAREPOINT-SCHEMA.md + the provisioning template.
7. Tests: service (mapping/validation/filter/cache), component (4 states +
   keyboard + axe + config), fixtures.
8. Update README phase table + COMPONENTS.md.
9. Do not touch unrelated sections.

### Add a new data source for spend (Power BI / Concur / API)
1. New class implementing `ITravelSpendService`
   (`PowerBiTravelSpendService` / `ConcurTravelSpendService`).
2. Enforce authorisation in that class (RLS token, API scope) — never in the UI.
3. Wire it by `spend.source` in `TravelHubWebPart.onInit()` (a small factory).
4. `DepartmentTravelSpendCard` is unchanged — it only knows the interface.
5. If a Graph/AAD scope is needed, add it to
   `package-solution.json` `webApiPermissionRequests`, document it, and get it
   approved in API access (DEPLOYMENT.md §4).

### Enable "aggregate pulse results for everyone"
Normal users cannot read `TH_QuickPulseResponses`. Options:
- **Rollup list:** a Power Automate flow / scheduled script (running with
  elevated rights) writes counts to a readable `TH_QuickPulseSummary` row per
  question. `QuickPulseService` reads that for non-admins. Set
  `quickPulse.showAggregateResults = true`.
- **Admins only:** leave the default; only Pulse Admins see results.
Document the choice; add tests for the summary read path.

### Add localization / Arabic + RTL
1. Add locale files under `webparts/travelHub/loc/` (`ar-sa.js`, etc.); keep
   `mystrings.d.ts` in sync.
2. Content localisation: add language-variant columns or a `Language` column to
   content lists, or use SharePoint's multilingual pages — decide with the
   business.
3. Flip `featureFlags.rtl`; the layout already uses logical CSS
   (`margin-inline-start`, `start`/`end`) so `dir="rtl"` on the root should
   mostly "just work" — audit carousels (arrow direction) and icons.
4. Date/number formatting already goes through `Intl` with `dates.locale`.

### Integrate analytics (Application Insights)
1. `TelemetryService` wrapping the AI web SDK; init in `onInit()` with the
   connection string from `TH_SiteConfiguration` (not code).
2. Track section render, carousel interactions, pulse submit, "View All" clicks.
3. No PII; respect any tenant consent requirements.
4. New dependency → justify in the phase plan before `npm install`.

### Change the design system / brand
- Edit **only** `src/common/styles/_tokens.scss` (and `_typography.scss`). The
  `--full-*` variables are the single source. No component stylesheet holds a
  brand hex, so a rebrand is one file + a visual regression pass.

### Add a page-author property-pane option
- Extend `ITravelHubWebPartProps` + `getPropertyPaneConfiguration()` in
  `TravelHubWebPart.ts`. Keep it to *instance* choices (which config set,
  environment banner). Content/behaviour stays in the list.

---

## General rules for any enhancement

1. **Check first:** does a common component / service / config key already do
   this? (COMPONENTS.md, CONFIGURATION.md.)
2. **Smallest change:** new code goes in a new file in the right layer; don't
   widen a component's responsibility.
3. **Interface before implementation** for anything touching data.
4. **Config over constants** for anything the business might tune.
5. **Token over hex**, **service over `fetch`**, **plain text over
   `dangerouslySetInnerHTML`**.
6. **Four states** on every dynamic thing.
7. **Tests + docs** ship with the change; update the phase table.
8. **Don't** touch unrelated files, don't reformat working code, don't bump the
   locked baseline (SPFx/React/TS/Node/Heft).
9. **Provisioning parity:** any schema change goes into
   `provisioning/travelhub-template.xml` so all environments stay identical.
10. **Record assumptions** in ASSUMPTIONS_AND_OPEN_QUESTIONS.md rather than
    guessing business rules.
