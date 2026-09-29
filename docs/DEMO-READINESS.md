# TravelHub – Demo Readiness Guide

One walkthrough to get a real site from "just the code" to "every section and
every navigation path on the home page shows real content." Read this
alongside [../provisioning/README.md](../provisioning/README.md) (how the
scripts work) and [../provisioning/SAMPLE-DATA.md](../provisioning/SAMPLE-DATA.md)
(what every column is for) — this doc is the checklist that ties them
together, section by section, screen by screen.

## 0. Why sections might look empty right now

Every section renders a friendly empty state instead of erroring when its
list has no data (by design). If Quick Pulse, testimonials, or anything else
on the home page shows "nothing here yet," the near-certain cause is: **the
list either doesn't exist on this site yet, or exists but has no items.**
That's fixed entirely in steps 1–2 below — there is no separate code fix
needed for "no data."

## 1. Provision the lists (once per site, safe to re-run)

1. Sign in to the target site with **Site Owner** rights.
2. `F12` → Console → paste the whole `travelhub-provision.js` → Enter.
3. Read the SUMMARY. `+` = created, `=` = already existed.

If this site was provisioned before Phases 7–10 or the global-nav/Travel
Policy work landed, **just re-run it** — see
["Re-running after this repo adds a list or a field"](../provisioning/README.md#re-running-after-this-repo-adds-a-list-or-a-field)
in the provisioning README for exactly what does and doesn't get touched.

## 2. Load demo content (once per site, safe to re-run)

1. Same page, `F12` → Console → paste the whole `travelhub-sample-data.js` →
   Enter.
2. Read the SUMMARY.

This fills **every** list below with realistic demo rows — home page,
navigation, and both Travel Policy pages — in one pass. `USE_PLACEHOLDER_IMAGES: true`
(the default) uses `picsum.photos`/`pravatar.cc` placeholder images so the
demo looks complete without any asset upload; swap in real imagery later by
editing the `*Url` columns (see step 6).

## 3. Set up the two permission groups

Two sections are permission-gated **by SharePoint list permissions**, not by
the web part (SECURITY.md §2/§3 — the UI is never the security boundary):

| Group (exact name, or your own — then update config) | Gates | Config key |
| --- | --- | --- |
| `TravelHub Pulse Admins` | "View All Traveler Survey" results | `quickPulse.pulseAdminGroup` |
| `TravelHub Spend Viewers` | Department Travel Spend figures | `spend.viewerGroup` |

Create the groups, add the right demo/reviewer accounts, and break
permission inheritance on `TH_QuickPulseResponses` and
`TH_DepartmentTravelSpend` so only the matching group can **read** them (a
commented `breakInheritanceExample()` helper is at the bottom of
`travelhub-provision.js`). Until you do this, both sections still render —
Quick Pulse just won't show a "View All Traveler Survey" link, and Spend
shows its "Restricted Access" panel — that's the correct default-denied
state, not a bug.

## 4. Add the web part to a page

1. Communication site page (or a Team site with navigation hidden — see
   [DEPLOYMENT.md §6a](./DEPLOYMENT.md#6a-full-width-page-edge-to-edge-no-left-nav)),
   **Full-width section**, one **TravelHub** web part in it.
2. Leave `layout.fullBleed = true` (the default) — it also hides the SharePoint
   suite/command bar for a true edge-to-edge look. That's a real, visible
   change for **every visitor of that page**, not just you — see the caveat
   in DEPLOYMENT.md before using it on a page other people also rely on for
   normal site navigation.

## 5. Walk every navigation path

The home page is one SPFx web part with its own lightweight in-app "screens"
(`NavigationContext.ts`) — clicking through never leaves the page or reloads
it, but the URL gets a `?thView=…` param so each screen is still a real,
shareable link and the browser back button works. Test each path once:

| From | Action | Goes to | Data source |
| --- | --- | --- | --- |
| Global nav bar | **Home** | back to the hub | — (the way back from every sub-screen below) |
| Global nav bar | any other service tab (Business Travel, Personal Travel, SAP Concur, Catering Services, Meetings & Events, …) | that service's own placeholder page (in-app) | `TH_TravelServices` row (by id) — content/layout TBD, see §7 |
| Global nav bar | **Travel Policy** tab | Travel Policy landing page (in-app) | `TH_PolicyPages` slug `travel-policy` |
| Global nav bar | Help Desk | hero quick-link destination, same tab | `TH_SiteConfiguration` (`hero.quickLink.helpDesk.*`) |
| Global nav bar | Travel Care | in-app image viewer popup (not a browser navigation — same viewer the hero card uses) | `TH_SiteConfiguration` (`hero.quickLink.travelCare.*`) |
| Quick Pulse card | **Submit Quick Pulse** | Quick Pulse submission screen | `TH_QuickPulseQuestions`/`Options` |
| Quick Pulse card | **View All Traveler Survey** (Pulse Admins only) | aggregate results screen | `TH_QuickPulseResponses` (counts only, never raw rows — SECURITY.md §2) |
| Testimonials carousel | **View All Stories** | full traveller feedback grid | `TH_TravelerTestimonials` (all active rows) |
| View All Feedback screen | **Submit Feedback** | feedback submission form | writes to `TH_TravelerTestimonials` with `IsActive = No` (moderation) |
| Travel Policy landing page | a policy-category card (e.g. "Annual Flight Ticket Benefits") | that detail page (in-app) | `TH_PolicyCards.TargetSlug` → another `TH_PolicyPages` row |
| Travel Policy landing page | an "Explore Policy Information" tile | (placeholder — see §7) | `TH_PolicyCards` kind `Info` |
| Any Travel Policy page | breadcrumb "Home" | back to the hub | — |

## 6. Replace placeholder content with the real thing

1. Upload real imagery to **Travel Hub Images**; paste each file's URL into
   the matching `*Url`/`*ImageUrl` column (hero slides, service cards, news,
   events, testimonials' `ProfileImage`, Green Travel, Travel Policy heroes,
   footer QR).
2. Business content owners edit rows directly in each list — every list
   opens in the normal SharePoint list UI (Site Contents → the list). See
   [SAMPLE-DATA.md](../provisioning/SAMPLE-DATA.md) for what each column
   means, and [SHAREPOINT-SCHEMA.md](./SHAREPOINT-SCHEMA.md) for the full
   column reference including the newer lists.
3. Reload the page after edits — content is cached 2–5 minutes
   (`MemoryCache` TTLs per service).

## 7. What's intentionally still a placeholder

- **"Ask Our Policy Assistant"** on the Travel Policy landing page is a
  static "Coming Soon" panel — no backend yet. It needs a decision on what it
  integrates with (Copilot Studio / Azure OpenAI / a plain FAQ search) before
  it can be built; the suggested-question chips already match the approved
  content spec, ready for whichever AI service gets chosen.
- **Business Travel Policy / Business Assignment Policy** detail pages, and
  the 6 "Explore Policy Information" topics, have no approved content spec
  yet (the current spec — `D:\TH\RSG_Travel_Policy_Pages_1_2_Content_Specifications.docx`
  — covers only the Travel Policy landing page and Annual Flight Ticket
  Benefits). Their cards render, but with no destination (`TargetSlug`/`LinkUrl`
  is empty, so the card shows but isn't clickable) until that content lands —
  add a `TH_PolicyPages` row + `TH_PolicyCards` rows the same way the
  Annual Flight Ticket Benefits page was built, then set the matching
  `TargetSlug` on the landing page's card.
- **Every Travel Services nav tab except Travel Policy** (Business Travel,
  Personal Travel Offers, SAP Concur Guidance, Catering Services, Meetings &
  Events, Expense Claim) opens a page reusing that service's own
  title/description/icon/image plus a "content and layout coming soon" note
  — a real destination instead of a dead link, but not a designed page yet.
  Give it real content/layout later by building it out the same way
  `ServicePageScreen` was, or by pointing its `TH_TravelServices` row at a
  proper detail page once one exists.
- Submitted testimonials need a human to flip `IsActive` to `Yes` before they
  appear (step 3 in provisioning/README.md's "After running").
