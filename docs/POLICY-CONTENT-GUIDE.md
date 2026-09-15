# Travel Policy Content — Editor's Guide

How to add, edit and reorder Travel Policy pages using nothing but the
SharePoint list forms/Quick Edit grid. No code changes are ever required to
add a new topic, table, tab or page — only to add a genuinely new *layout*
that none of the 9 below already covers.

For the underlying column reference see `SHAREPOINT-SCHEMA.md`. This guide
is the "how do I actually do X" companion to that reference.

## 1. The model, in one picture

```
TH_PolicyPages            (one row per page - hero, CTA, Need Help, footer)
  └─ TH_PolicySections     (one row per content block, in DisplayOrder)
       ├─ TH_PolicyCards      (cards directly in the section)
       ├─ TH_PolicyTables     (tables directly in the section)
       │    └─ TH_PolicyTableRows  (rows of a table)
       └─ TH_PolicyTabs       (only for Layout = Tabs)
            ├─ TH_PolicyCards    (cards inside a tab, via TabId instead of SectionId)
            └─ TH_PolicyTables   (tables inside a tab, via TabId instead of SectionId)
```

A **section** is one ordered block of content on a page — a paragraph, a
grid of cards, a table, a tabbed group, a numbered list, a callout, an
image, or a row of links. A page is just its sections, in `DisplayOrder`.

## 2. Adding a brand-new page

1. Add a row to **TH_PolicyPages**. Minimum fields: `Title`, `Slug` (the
   routing key — lowercase, hyphenated, must be unique, e.g. `visa-support`),
   `IsActive = Yes`.
2. To nest it under Travel Policy (breadcrumb `Home > Travel Policy > …`),
   set `ParentSlug = travel-policy`, `ParentTitle = Travel Policy`. If it
   should also show a non-clickable middle crumb like "Explore Policy
   Information", set `ParentSectionLabel` too.
3. Fill in the hero fields (`HeroTitle`, `HeroSubtitle`, `HeroDescription`,
   `HeroImageUrl`, `HeroIcon`).
4. **Link to it from somewhere** — a page is only reachable if another
   card's `TargetSlug` points at its `Slug`. Usually that's an `Info` card
   in the landing page's "Explore Policy Information" section (see §4), but
   any card anywhere can carry a `TargetSlug`.
5. Optional page-level extras: `SuggestedQuestions` (one per line — shows
   the "Ask Policy Assistant" block; leave blank to hide it), `CtaTitle`
   /`CtaDescription`/etc. (a call-to-action row), `NeedHelpTitle`/etc. (a
   contact row), `ClosingBannerTitle`/etc. (the green "Travel with Purpose"
   footer band).

## 3. Adding content to a page — one recipe per layout

Every section starts the same way: add a row to **TH_PolicySections** with
`PageId` = the page, `Layout` = one of the 9 choices below, `DisplayOrder`
= its position among that page's sections, `Title`/`Subtitle` = an optional
heading shown above the content (leave blank for no heading).

| Layout | What it looks like | What else to fill in |
| --- | --- | --- |
| **Paragraph** | Plain text, one `<p>` per line | `Body` — one paragraph per line |
| **CardsGrid** | A responsive grid of cards | `CardVariant` (`Category` large linking tiles / `Info` small icon tiles / `Highlight` icon+title+description), then add `TH_PolicyCards` rows with `SectionId` = this section |
| **Table** | An HTML table (can stack several) | Add `TH_PolicyTables` rows with `SectionId` = this section (see §3a) |
| **Tabs** | A tabbed group | Add `TH_PolicyTabs` rows with `SectionId` = this section, then cards/tables *inside each tab* use `TabId` instead of `SectionId` (see §3b) |
| **NumberedSteps** | Big numbered circle + title + description | Add `TH_PolicyCards` with `SectionId` = this section, `Kind = Rule`, `Number` = 1, 2, 3… |
| **ProcessSteps** | Small numbered chain with arrows between | Same as NumberedSteps but `Kind = HelpStep` |
| **Callout** | A tinted info/warning box | `Body` (the notice text), `Icon` (optional, e.g. `Warning`) |
| **ImageBlock** | One image with an optional caption | `ImageUrl`, and `Body` for the caption |
| **LinksList** | A row of link pills | Add `TH_PolicyCards` with `SectionId` = this section, `Kind = LinkItem`, `LinkUrl`/`LinkText` |

### 3a. Adding a table

1. Add a row to **TH_PolicyTables**: `SectionId` = the parent section (or
   `TabId` if it's inside a tab — never set both), `Title` (optional, e.g.
   "Air Travel Entitlement" when several tables share one section/tab),
   `ColumnHeaders` = one header per line, e.g.:
   ```
   Travel Type
   Submit Request
   ```
2. For each row of the table, add a row to **TH_PolicyTableRows** with
   `TableId` = the table above, `CellValues` = one value per line, **in the
   same order as `ColumnHeaders`**, e.g.:
   ```
   GCC Countries
   At least 5 business days before travel
   ```
3. Repeat for as many rows/tables as needed. `DisplayOrder` controls the
   order of both tables within a section and rows within a table.

### 3b. Adding tabs (e.g. "Business Travel" vs "Business Assignment")

1. Create the parent section with `Layout = Tabs`.
2. Add one **TH_PolicyTabs** row per tab: `SectionId` = that section,
   `Title` = the tab label, `DisplayOrder` = tab position.
3. Add the tab's own content as normal `TH_PolicyCards`/`TH_PolicyTables`
   rows, but set **`TabId`** to that tab (leave `SectionId` blank on
   these — `TabId` is what nests them inside the tab instead of loose in
   the section). Each tab can have its own tables and its own cards.

## 4. Linking a page from a tile/card

Any `TH_PolicyCards` row can navigate in-app instead of (or as well as)
showing a plain card: set its `TargetSlug` to the target page's `Slug`.
`TargetSlug` always wins over `LinkUrl` if both are set. This is exactly
how the 6 "Explore Policy Information" tiles on the landing page reach the
6 sub-pages — no other wiring is needed; the web part resolves any slug you
put in `TargetSlug` automatically.

## 5. Editing existing content

Just edit the row. SharePoint's **Quick Edit** (grid) view is the fastest
way to touch several `TH_PolicyCards`/`TH_PolicyTableRows` rows at once —
it's a spreadsheet-style grid, no need to open each item's form.

- To hide something without deleting it, set `IsActive = No` (pages,
  sections, cards and tables all support this).
- To reorder things, change `DisplayOrder` (lower numbers come first,
  within the same parent).
- To change wording, just edit the field and refresh the page — content is
  cached for 10 minutes, so an edit can take up to that long to appear
  (or clear your browser cache / wait it out).

## 6. What's already loaded

`provisioning/travelhub-sample-data.js` seeds the Travel Policy landing
page, Annual Flight Ticket Benefits, and all 6 "Explore Policy Information"
sub-pages (Purpose & Scope, Guiding Principles, Travel Planning &
Approvals, Travel Entitlement, Expenses, Compliance & Responsibilities)
with the approved content from the two specification documents. Use that
script's output as a working example of every layout above — e.g.
`addPolicySection`/`addPolicyTables` calls in `seedPolicyPages()` are a
literal reference for what values go in which field.
