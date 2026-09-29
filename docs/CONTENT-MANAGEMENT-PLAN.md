# Travel Hub content pages — analysis and re-implementation plan

Status: **proposal — nothing in this document is implemented yet.**
Scope: every mock-driven content page (Travel Policy and its 6 sub-pages,
Business Travel and its 2 sub-pages, Personal Travel Offers, Meetings &
Events, SAP Concur) and the pages that will follow.
Source mocks: `D:\RSG\Travel Hub\Mokup by RSG\Mocks` (4 PDFs, 17 pages).

---

## 1. Why content isn't displaying as the mocks show

The current policy pages are driven by six linked SharePoint lists
(`TH_PolicyPages → TH_PolicySections → TH_PolicyCards / TH_PolicyTables →
TH_PolicyTableRows / TH_PolicyTabs`) and one shared renderer
(`PolicyPageScreen` + `PolicyCardSections`). The model offers **9 generic
layouts**; the mocks use **about 25 distinct visual patterns** (inventory in
§2). The gap has been bridged with three workarounds, and each is a
direct cause of the problems seen:

| Workaround | Where | What goes wrong |
| --- | --- | --- |
| **Hidden text markup inside `SubPoints`** — `##Header\|Header` starts a table, `Cell\|Cell` is a row, `!!` a callout, `@Icon\|…` an icon block, `%%` a tag, `1. …` numbered | `parseHighlightSubPoints.ts` | Editors can't see or discover it. One slip turns a table into bullets/paragraphs: a missing `##` line, a row without `\|`, a tab or "•" pasted from Word/PDF, or one line not starting `1.` in a numbered list. This is the **Key Policy Highlights** symptom (its two mini-tables are `SubPoints` markup). |
| **Layout chosen by exact section title** — `ICON_LEFT_HEADER_SECTIONS`, `UNDERLINE_TITLE_SECTIONS` | `PolicyCardSections.tsx` | Rename a section ("Key Policy Highlights" → "Key Highlights") and its layout silently changes. Every new page needs a code change and a redeploy to look right. |
| **Colour/theme from `IconColor` only; numbering from `1. Title` text** | cards, section titles | The mocks tint whole cards (blue/green/amber/red/purple bands, matching underline, tinted callout); there's no field for that, so cards can't match. |

Structural limits on top of those:

- **No nesting.** Mock blocks contain other blocks (e.g. Travel Planning §1 is a
  numbered panel containing text + an icon table + a callout; Travel
  Entitlement is a selector whose options each contain four columns of
  tables and notes). A flat "section → cards" model can't express this, so
  content gets flattened into paragraphs.
- **Editing is by numeric ID across 6 lists.** Editors must know that card
  42 belongs to section 17 on page 3. Quick Edit can't show the hierarchy,
  there's no preview, and there's no draft → publish, so half-finished
  edits go live.
- **Business Travel has its own separate lists and screen**
  (`TH_BusinessTravel*`, `BusinessTravelPageScreen`), so every page family
  grows its own schema.

**Conclusion:** styling fixes page by page won't close this. Each new page
adds more title-matching and markup rules. The model needs block types
that match the mocks 1:1, nesting, and an editor that removes hand-typed
markup.

## 2. Pattern inventory (mocks → reusable blocks)

Every one of the 17 mock pages is built from the same ~20 blocks. Building
these **once** covers all current pages and the "similar pages" to come.

| # | Block | Seen on (examples) | Key fields |
| --- | --- | --- | --- |
| 1 | **Page hero** — icon disc, eyebrow, title, subtitle, tagline, photo with script slogan, optional 3–4 feature strip | all pages | icon, eyebrow, title, subtitle, tagline, image, slogan, features[] |
| 2 | **Intro panel** — icon + title + paragraphs | Purpose, Our Commitment | icon, title, rich text |
| 3 | **Feature banner** — tinted, icon + title + gold underline + text | Business Travel + Annual Vacation, Company-Determined Arrangements, Additional Entitlement | theme, icon, title, rich text |
| 4 | **Card grid** — 2/3/4/5 columns, each card themed (tint + underline colour), icon left/top | Which Policy Applies, How We Approach, Allowable / Non-Allowable | columns, iconPosition, cards[] (theme, icon, title, rich text, bullets, nested callout) |
| 5 | **Numbered panel** — number badge + title + subtitle, *contains child blocks* | Planning 1–4, Expenses 1–4, Compliance 1–6 | number, theme, title, subtitle, children[] |
| 6 | **Data table** — header row, optional icon column, bold emphasis, optional per-column header icons, zebra | Plan Before You Travel, Flight Ticket Class, Relocation class tables | title, columns[], rows[][] (cells allow **bold** + icon) |
| 7 | **Callout** — info / warning / success / exception, optional label, optional side link | Plan Early, Exception, Not sure which category applies? | tone, icon, label, text, link |
| 8 | **Selector (switcher)** — 2+ large option cards; picking one swaps the content below and updates the banner | Travel Entitlement (Business Travel ↔ Business Assignment) | options[] (icon, title, subtitle, text, theme, children[]) |
| 9 | **Column group** — equal columns each holding child blocks | Entitlement's 4 category columns, Employee vs Approver responsibilities | columns[] (children[]) |
| 10 | **Process flow** — icon steps with arrows, optional numbers, optional footer note | Before You Submit Your Claim, SAP Concur workflow, Offline process, booking process | steps[] (icon, title, text), note |
| 11 | **Checklist row** — check icons | Quick Compliance Check | items[] |
| 12 | **Icon list** — one icon per row, optional role tag | Employee / Approver Responsibilities | tag, items[] (icon, text) |
| 13 | **Stat tile** — big figure + caption, optional image beside | SAR 25,000 shipping, 48 hours, 2–3 days | value, caption, icon, image |
| 14 | **Media panel** — text + side image (+ optional stat tile) | Shipping Assistance, Transportation, Flight Tickets | icon, title, rich text, image, stat |
| 15 | **Tile row** — small icon tiles with arrow | Key Business Travel Policy Highlights, Explore Policy Information | tiles[] (icon, label, target) |
| 16 | **Image card grid** — photo, badge, title, text, price/"from", CTA | Business Travel & Mobility, Personal Travel offers, partnered hotels | cards[] (image, badge, title, text, price, cta, channel) |
| 17 | **Link cards** — icon/image + title + text + chevron | Accommodation & Site Services, Quick Actions, More Details / Contact HR | cards[] |
| 18 | **FAQ list** — numbered question rows opening an answer | SAP Concur Most Asked Questions | items[] (q, a) |
| 19 | **Contact / Need help** — contacts, QR, email/phone/WhatsApp | all pages | contacts[], qr |
| 20 | **Assistant prompt** — AI Powered badge, suggested questions, Ask button | policy sub-pages | questions[], link |
| 21 | **Closing band** — "Travel with Purpose" + 3 badges, photo | all pages | title, text, badges[], image |

Blocks 19–21 are page-level settings, not blocks.

## 3. Options considered

| Option | Look & feel fidelity | Ease for editors | Effort | Verdict |
| --- | --- | --- | --- | --- |
| **A. Patch the current lists** — add Variant/Theme columns, stop title matching, make the markup parser forgiving | Medium — still no nesting, Entitlement selector and numbered panels stay approximations | Low — still 6 lists, IDs, hidden markup | Small | Short-term fix only |
| **B. SharePoint modern pages + out-of-box web parts** | Low — can't reproduce the mocks | High | Small | Rejected |
| **C. Block model + in-app page editor** (recommended) | High — blocks match mocks 1:1, nesting supported | High — forms, previews, no markup, no IDs | Medium–large | **Recommended** |

## 4. Recommended design (Option C)

### 4.1 Storage — one item per page

A new list **`TH_ContentPages`** (the six `TH_Policy*` lists and the
`TH_BusinessTravel*` lists stay untouched during migration):

| Column | Type | Purpose |
| --- | --- | --- |
| Title, Slug | text | routing key (`?thView=page/<slug>`) |
| ParentSlug | text | breadcrumb and hierarchy |
| Status | choice: Draft / Published | draft → publish workflow |
| PageJson | multi-line plain text | the whole page: page settings + ordered block tree |
| PublishedJson | multi-line plain text | what viewers see — publish copies Draft → Published |
| SchemaVersion | number | for safe future block changes |

One item per page makes save/publish atomic. **List versioning gives full
history and one-click rollback.** "Duplicate page" becomes a new page from a
template, and pages move between Dev/UAT/Prod as JSON files through the
existing provisioning scripts. Images stay in a Site Assets library,
referenced by URL.

### 4.2 Rendering

- A **block registry** (`blockType → React component`) with one component per
  row of §2, styled with the shared tokens (the HR Hub branding delivered
  alongside this plan), so every page matches automatically.
- A **JSON schema per block**, validated on load. An invalid block shows a
  small "content needs attention" placeholder to editors and is hidden from
  viewers. The rest of the page still renders.
- **Formatting without HTML:** text fields accept a small safe subset —
  `**bold**`, links, line breaks, bullet lists — rendered as React nodes and
  never injected as HTML.
- Themes (`blue`, `green`, `amber`, `red`, `purple`, `gold`, `neutral`) are a
  **choice field per block and card**, not a colour code, so editors pick
  "Green" and get the mock's tint, underline, icon disc and callout colours
  together.

### 4.3 Editing — in-app "Edit page" mode

Visible only to members of a `Travel Hub Content Editors` group:

- **Edit** toggles the page into edit mode, with an outline of blocks on the
  left and a live preview on the right.
- **Add block** opens the block catalogue, with a thumbnail of each block
  from the mocks.
- **Per-block forms** use plain fields, icon picker, theme picker and image
  picker. There is nothing to memorise.
- **Table editor** is a grid: add/remove rows and columns, and **paste straight
  from Excel or Word** (tab-separated cells are detected). This removes the
  table-becomes-paragraphs problem at the source.
- Drag to reorder, duplicate or delete a block. Nested blocks (inside numbered
  panels, selector options and columns) edit in place.
- **Save draft / Preview / Publish**, plus version history with restore.
- **New page from template:** "Policy sub-page", "Relocation page" and
  "Offers page" start with the right skeleton.

Power users can still read the JSON in the list. Normal editing never needs it.

### 4.4 Migration and compatibility

- A one-time **migration script** converts the existing `TH_Policy*` and
  `TH_BusinessTravel*` rows into page JSON, mapping `SubPoints` markup to
  real table, callout and list blocks.
- The new renderer runs **alongside** the current `PolicyPageScreen`.
  `TH_ContentPages` is checked first; a page that hasn't migrated keeps
  rendering exactly as today. Pages move over one at a time, so nothing
  changes for a page until it is deliberately switched. The old lists retire
  only after sign-off.

## 5. Delivery phases (rough estimates)

| Phase | Output | Estimate |
| --- | --- | --- |
| 0. Sign-off | Business confirms the block catalogue (§2) and theme names against the mocks | 2–3 days |
| 1. Renderer | Block registry, 18 blocks, schema validation, safe rich text. The 6 Travel Policy sub-pages rebuilt from JSON fixtures and compared side by side with the mocks | ~2 weeks |
| 2. Storage | `TH_ContentPages` provisioning, service + caching, draft/publish, migration script for existing content | ~1 week |
| 3. Editor | Edit mode, block forms, table grid with paste, reorder, templates, version restore, permission gating | 2–3 weeks |
| 4. Remaining pages | Business Travel home + Employee/Family Relocation, Personal Travel Offers, Meetings & Events, SAP Concur (incl. the Plan & Book detail view) — **authored as content, no code** | 1–2 weeks |
| 5. Handover | Editor guide with screenshots, retire old lists | 2–3 days |

## 6. If Key Policy Highlights must be fixed before this starts

A scoped stop-gap, touching only the `SubPoints` parser:

- Accept tab-separated cells and pasted "•"/"–" bullets.
- Treat a block of consecutive `a|b` lines as a table even without the `##` line.
- Warn in the browser console when a card's markup can't be parsed.

This applies only to cards that use `SubPoints`, and it's thrown away once
Phase 1 lands.

## 7. Decisions needed

1. Approve Option C, or choose the stop-gap only for now.
2. Who can edit content: a new `Travel Hub Content Editors` SharePoint
   group, or an existing group?
3. Does publishing need an approval step (Draft → Review → Published), or is
   Draft → Published enough?
4. Should Personal Travel Offers and Meetings & Events hotel prices be
   entered by editors, or come from a partner feed later? This decides
   whether block 16 needs a data-source option.
