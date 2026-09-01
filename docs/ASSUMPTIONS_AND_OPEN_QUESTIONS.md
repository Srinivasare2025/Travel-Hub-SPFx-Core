# TravelHub – Assumptions & Open Questions

## What this is

Everything inferred from the Phase 1 mockup where the image is not explicit, plus
the questions the business needs to answer. **Nothing here is invented as a
requirement** — each item has a safe, configurable default so development can
proceed, and a note on what would change if the business decides otherwise.

Format: **A#** = assumption made (with fallback). **Q#** = question for the
business. Status: `open` until confirmed.

---

## Brand & identity

**A1 — Brand name is configurable.** The footer logo reads "RSG" and Quick Pulse
copy says "RSG Travel Services", while the design-token prefix given is `--full-`.
Assumption: the token prefix `--full-*` is a naming convention only; the
user-visible brand name is a config value `brand.name` (default `RSG`).
_If wrong:_ change one config row; no code change.

**Q1 — What is the correct display brand name and does it differ by audience
(e.g. English "RSG" vs Arabic)?** `open`

**A2 — Palette is used semantically, not literally.** Gold `#b89c66` =
primary/accent/CTA; navy `#04253c` = headings, footer background, primary text;
`#7b8794` = metadata; `#e8e5e0` = borders. Contrast pairs will be chosen to meet
AA; where a brand hex fails contrast for body text, token *usage* changes (e.g.
navy text on gold, not gold text on white).
_If wrong:_ adjust token mapping in `_tokens.scss`.

**Q2 — Is there a brand font licensed for web (the stack starts with "Segoe
UI")? Any logo asset pack, favicon, or brand guideline PDF?** `open`

---

## Hero banner

**A3 — Hero slide count, media mix and content come entirely from
`TH_HeroBanners`.** The mock shows one composed hero; number of slides and
image-vs-video split are not visible. Default seed: 2–3 image slides,
`hero.autoPlay = true`, 6s.
**A4 — The two quick links are static configuration, not carousel slides, and not
the same as the "Explore Our Travel Services" cards.** Rendered once, below the
rotating media.
**A5 — Hero video, when used, is muted, has no autoplay-with-sound, shows a
poster, and provides controls.** (Accessibility + policy.)

**Q3 — Do the hero quick links point to pages, a form, a phone number
(`tel:`), or a Teams/So chat? Provide the real targets.** `open`
**Q4 — Should the hero pause on hover only, or also stop after one full cycle?**
Assumption: pause on hover/focus, otherwise loop. `open`

---

## Explore Our Travel Services

**A6 — Card count is dynamic.** The mock shows 6; implementation renders whatever
`TH_TravelServices` contains, `services.desktopVisibleCards` (default 4) visible
at once with carousel paging.
**A7 — `Icon` + `IconBackgroundColor` are per-card fields.** Icons are Fluent
UI v8 icon names (already available) or asset keys; background is a validated
colour/token.
**A8 — Link label ("Learn More" / "Explore Offers" / "View Policies") is a
per-row `LinkText`**, defaulting to `services.defaultLinkText`.

**Q5 — Canonical list of Phase 1 services and their destination URLs
(SharePoint pages? external? SAP Concur SSO deep link?).** `open`
**Q6 — Is "SAP Concur" a link out to Concur (SSO) or an internal info page?**
Assumption: external link, new tab. `open`

---

## Travel Updates & Insights

**A9 — Three independent cards, each with its own list, its own
loading/empty/error, and its own "View All" (text + URL configurable).**
**A10 — News: the first item (by `IsFeatured` desc, then `DisplayOrder`, then
`PublishDate` desc) renders as the large featured card; the rest as
thumbnail rows.**
**A11 — `OnPremReference` news items are links to the legacy on-prem farm, shown
with a small "opens legacy site" indicator; no content is migrated or proxied.**
Gated by `featureFlags.newsOnPremLinks`.
**A12 — Events show only today/future events, sorted by date, capped at
`updates.events.count` (default 4). Date block = day + short month, localised,
optional Hijri line.**
**A13 — Event "category" (e.g. "Partner Roadshow", "Campaign Launch") is a
`Category` field rendered as a badge.**
**A14 — Tips are simple icon + text rows; an optional per-tip link is
supported but not required.**

**Q7 — "View All" for news / events / tips: do target pages exist yet, or do we
need to create list-view pages? Provide URLs or confirm we build them in a later
phase.** `open`
**Q8 — On-prem farm base URL(s) and are they reachable from users' browsers
(network/VPN)?** `open`
**Q9 — Should past events auto-hide, or show a separate "past events" area?**
Assumption: auto-hide (future-only). `open`

---

## Quick Pulse

**A15 — Question, options, icons and labels are fully list-driven** (mock shows
one 5-point emoji scale: Excellent / Good / Average / Poor / Very Poor with
values 5–1).
**A16 — A normal user can submit their own response and see a confirmation
state; they cannot see other users' responses.** Enforced by list permissions +
service shape (SECURITY.md).
**A17 — "View Previous Results" shows aggregate results only, and only to Pulse
Admins by default** (`quickPulse.showAggregateResults = false`). Everyone-visible
aggregates require an admin-run rollup (ENHANCEMENT-GUIDE recipe).
**A18 — One response per user per active question** when
`OneResponsePerUser = Yes` (default yes); re-visiting shows the locked/"thanks"
state.
**A19 — Comments are optional and only stored, never displayed to normal users.**

**Q10 — Should aggregate results be visible to all employees? If yes, is a
scheduled/admin rollup acceptable (needed because normal users can't read the
raw response list)?** `open`
**Q11 — Can a user change their response during the active window, or is it
locked after first submit?** Assumption: locked. `open`
**Q12 — Retention/anonymity policy for pulse responses and comments?** `open`

---

## What Our Travellers Say

**A20 — The ambiguous person-info line under each testimonial** (mock shows
things like "Principal – Jeddah", "Analyst – Riyadh") **is treated as
`{designation} – {location}` by default** (`testimonials.personInfoTemplate`),
with an optional per-row `PersonInfoLine` that, if set, is rendered verbatim.
`Department` is captured but not shown by default.
**A21 — ~3 cards visible on desktop, auto-scroll + manual + keyboard, from
`TH_TravelerTestimonials`.**
**A22 — Rating is a 1–5 star display.**

**Q13 — Confirm the meaning/format of the person line: is it Role–City,
Department–City, or Role–Department? Should Department ever show?** `open`
**Q14 — Are testimonials attributed to real named employees (consent obtained),
or anonymised/representative?** `open`
**Q15 — Do testimonial photos come from the Images library, or from user
profiles (Graph)?** Assumption: Images library URL field. `open`

---

## Department Travel Spend Overview

**A23 — TravelHub does not calculate spend.** It displays figures a source
provides, or an access-denied panel. No aggregation, currency conversion, or
period math in the SPFx code.
**A24 — Access is enforced at the data source** (restricted list, Power BI RLS,
or Concur/API auth). The card calls `ITravelSpendService.getAccess()` first;
denied → the mock's friendly panel + "View Travel Dashboard" link.
**A25 — Default source is a restricted SharePoint list** (`spend.source =
sharepoint`); the abstraction allows swapping to Power BI / Concur / warehouse /
API later with no UI change.
**A26 — When permitted, the card shows summary tiles (Total / Air / Hotel /
Ground / Booking) straight from the model.**

**Q16 — What is the real system of record for travel spend (SharePoint / Power
BI / SAP Concur / data warehouse / finance API)?** `open`
**Q17 — Who is authorised (which AD/M365 group, role, or per-department
mapping)? How is "my department" determined — Graph profile, an HR list, a
mapping list?** `open`
**Q18 — What period granularity and currency handling does the business expect
(month/quarter/YTD; single vs multi-currency)?** `open`
**Q19 — Does "View Travel Dashboard" go to a Power BI report? Provide the URL and
its own access model.** `open`

---

## Green Travel

**A27 — One active `TH_GreenTravel` record**: title, description, newline-
delimited bullet points, one image, one link (e.g. to a poster PDF in the
Documents library).
**A28 — The right-side image gets a brand gradient overlay via CSS only**; the
source image file is never modified.

**Q20 — Is the "Explore Green Poster" link a PDF, a page, or an external site?
Provide it.** `open`
**Q21 — Are the four bullet points fixed copy, or should each be individually
linkable (which would justify a child list)?** Assumption: fixed copy, newline
field. `open`

---

## Meet the Travel Team

**A29 — Team members come from `TH_TravelTeam`** (not from Azure AD / Graph), so
the business controls exactly who appears and in what order.
**A30 — The landing page shows `team.landingPageCount` (default 4)**; "View All"
goes to a configurable team page.
**A31 — Contact affordances are `mailto:` and `tel:` only**, built from sanitised
field values.
**A32 — The secondary line** (mock shows e.g. "Employee affairs, campaigns,
engagement") **maps to `Specialization`**, falling back to `Department`.

**Q22 — Does a full "Travel Team" page already exist? URL?** `open`
**Q23 — Photos: Images library, or user profile photos via Graph?** Assumption:
Images library. `open`
**Q24 — Show phone numbers to everyone, or hide behind a click / omit on
mobile?** Assumption: show as `tel:` link. `open`

---

## Footer

**A33 — Up to six columns, fully list-driven** (`TH_FooterColumns` +
`TH_FooterLinks`); business/admin edit links without code.
**A34 — Brand block (logo + copyright + optional "Last Updated" + optional QR)
is configuration**, not hard-coded. Copyright default `© {year} {brand}. All
rights reserved.`
**A35 — Legal links (Privacy / Terms / Accessibility) are just footer links** in
a column, not special-cased.

**Q25 — Provide the real footer column titles, links, the QR code target, the
logo asset, and whether "Last Updated" is manual or should reflect the last
content change.** `open`
**Q26 — Any required legal/compliance links or text (privacy notice, PDPL
statement) for the footer?** `open`

---

## Cross-cutting

**A36 — Dates default to `en-GB` formatting; Hijri display is off by default**
and enabled per-tenant via `dates.showHijri`. Where shown, Hijri uses the
Umm al-Qura calendar.
**A37 — Arabic / RTL is a future enhancement** (`featureFlags.rtl`), not Phase 1.
Components are built layout-direction-agnostic (logical CSS properties,
`start`/`end`) to make it cheap later.
**A38 — No Microsoft Graph in Phase 1.** Graph is introduced only if Q17
resolves to "use the profile department" (scope `User.Read`).
**A39 — Analytics/telemetry is not in scope for Phase 1.** If required later,
prefer Application Insights via a dedicated service (recorded in
ENHANCEMENT-GUIDE).
**A40 — The page is a single SPFx web part** placed on one SharePoint page (not a
full-page app, not multiple web parts) unless the business asks otherwise.

**Q27 — Target hosting site URL(s) for dev / UAT / prod, and which App Catalog
(tenant vs site-collection)?** `open`
**Q28 — Who owns content editing (one team vs per-section owners)? This drives
whether we split edit permissions per list.** `open`
**Q29 — Accessibility conformance target — is WCAG 2.1 AA the requirement?**
Assumption: yes. `open`
**Q30 — Supported browsers/devices matrix (Edge/Chrome/Safari; min mobile
width)?** Assumption: evergreen Edge/Chrome/Safari, mobile ≥ 360px. `open`

---

## How this list is maintained

- Every phase adds/updates entries as new ambiguity surfaces.
- When the business answers a question, replace the assumption's fallback with
  the decision, set status `resolved (date)`, and open a follow-up task if code
  must change.
- No assumption is silently promoted to a requirement — it stays visible here
  with its origin.
