# Travel Hub Content Management Guide

**Who this is for:** Travel Hub content editors and site owners who maintain
pages in SharePoint lists, plus the administrator who runs the provisioning
scripts (§14).

Every content page in the Travel Hub is built from SharePoint lists, with no
code per page:
- Travel Policy and its sub-pages
- Annual Flight Ticket Benefits
- Business Travel, Employee Relocation and Family Relocation
- Personal Travel Offers
- Meetings & Events
- SAP Concur and its 4 sub-pages

A new page is a new row plus its sections and cards. Code is needed only for a
genuinely new *kind* of block that none of the layouts in §4 can produce.

**Contents**

1. [How a page is built](#1-how-a-page-is-built)
2. [Quick start: create a new page](#2-quick-start-create-a-new-page)
3. [Pages: `TH_PolicyPages`](#3-pages-th_policypages)
4. [Sections: `TH_PolicySections` and the layout catalogue](#4-sections-th_policysections-and-the-layout-catalogue)
5. [Section presentation options](#5-section-presentation-options)
6. [Cards: `TH_PolicyCards`](#6-cards-th_policycards)
7. [Tables: `TH_PolicyTables` and `TH_PolicyTableRows`](#7-tables-th_policytables-and-th_policytablerows)
8. [Tabs: `TH_PolicyTabs`](#8-tabs-th_policytabs)
9. [Writing text: SubPoints, Body and inline formatting](#9-writing-text-subpoints-body-and-inline-formatting)
10. [Navigation and links](#10-navigation-and-links)
11. [Images, icons and colours](#11-images-icons-and-colours)
12. [Day-to-day editing](#12-day-to-day-editing)
13. [Recipes: mockup pattern → configuration](#13-recipes-mockup-pattern--configuration)
14. [Administrator tasks](#14-administrator-tasks)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. How a page is built

```
TH_PolicyPages                  one row per page: hero, page-level blocks, footer band
  └─ TH_PolicySections          one row per content block, shown in DisplayOrder
       ├─ TH_PolicyCards        cards / parts / steps / tiles of that block   (SectionId)
       ├─ TH_PolicyTables       tables of that block                         (SectionId)
       │    └─ TH_PolicyTableRows  rows of a table                             (TableId)
       └─ TH_PolicyTabs         only for Layout = Tabs                        (SectionId)
            ├─ TH_PolicySections  whole sections INSIDE a tab                 (TabId)
            ├─ TH_PolicyCards     (older style) cards directly in a tab       (TabId)
            └─ TH_PolicyTables    (older style) tables directly in a tab      (TabId)

TH_TravelServices.PageSlug      makes a service's nav tab / card open a page
```

On screen, a page is rendered top to bottom:

1. Breadcrumb.
2. Hero.
3. Info banner (optional).
4. **Sections**, in `DisplayOrder`. Sections with a `Width` other than Full sit side by side.
5. Note banner, "Ready to proceed?" row, "Ask Policy Assistant" and "Need Help?" (each optional).
6. Closing band (optional).

Everything under "Sections" is yours to build. The rest are fixed page-level
blocks that you switch on by filling in their columns.

Every row in every list has `IsActive` (Yes/No) and `DisplayOrder`
(Number). `IsActive = No` hides the row without deleting it. Lower
`DisplayOrder` numbers come first within the same parent.

---

## 2. Quick start: create a new page

1. **Page row.** In `TH_PolicyPages`, add `Title` and `Slug`. The Slug is lowercase, hyphenated and unique, e.g. `visa-support`. Set `IsActive = Yes` and fill in the hero columns (§3.2). Use `HeroStyle = Light` for the mockups' look.
2. **Breadcrumb.** Set `ParentSlug` and `ParentTitle`, e.g. `travel-policy` / `Travel Policy`.
3. **Sections.** For each block of the page, add a row to `TH_PolicySections`:
   - `PageId` = the page.
   - `Title`. Always fill it in; use `HideTitle = Yes` if the heading shouldn't show (§5).
   - `Layout` (§4).
   - `DisplayOrder`: 10, 20, 30… leaves room to insert blocks later.
4. **Cards and tables.** Add the section's cards (§6) and tables (§7), with `SectionId` = that section.
5. **Make it reachable.** Do one of these:
   - Set a card's `TargetSlug` = the new Slug. A card anywhere can do this, e.g. a tile on the parent page.
   - Set a hero button's target to the new Slug.
   - Set `TH_TravelServices.PageSlug` so a top-navigation tab opens it (§10).
6. **Check it.** Refresh the Travel Hub page and open the new page.

> Fastest way to start: copy the structure of an existing page that looks
> similar. The sample-data script (§14) builds 18 working pages; each one is
> a complete example.

---

## 3. Pages: `TH_PolicyPages`

### 3.1 Identity and navigation

| Column | What it does |
| --- | --- |
| `Title` | Page name, used in the breadcrumb |
| `Slug` | The page's address inside the app (`?thView=policy/<slug>`). Lowercase and hyphenated. Don't change it once other cards link to it. |
| `ParentSlug` / `ParentTitle` | The breadcrumb parent (clickable), e.g. `sap-concur` / `SAP Concur`. Use `business-travel` to go back to the Business Travel page. |
| `ParentSectionLabel` | Optional non-clickable middle crumb, e.g. "Explore Policy Information" |
| `IsActive` / `DisplayOrder` | Show or hide the page / sort order in the list |

### 3.2 Hero (the banner at the top)

| Column | What it does |
| --- | --- |
| `HeroStyle` | `Dark` (default): text over a darkened photo. `Light`: the mockups' light band with a big icon disc and the photo fading in on the right. |
| `HeroIcon` | Icon name for the disc (§11) |
| `HeroEyebrow` | Small spaced capitals above the title, e.g. `TRAVEL POLICY`, `SAP Concur` |
| `HeroTitle` | Big title (falls back to `Title`) |
| `HeroSubtitle` | Bold line under the title |
| `HeroDescription` | Normal text under that |
| `HeroImageUrl` | Photo (§11) |
| `HeroTagline` | Script text over the photo. **One phrase per line**, e.g. `People Closer` / `A Brighter Tomorrow`. |
| `HeroLinkText` + `HeroLinkUrl` or `HeroLinkTargetSlug` | First hero button (gold), e.g. "Access SAP Concur". An external URL opens in a new tab. |
| `HeroLink2Text` + `HeroLink2Url` or `HeroLink2TargetSlug` | Second button (outlined), e.g. "New to SAP Concur? Start Here" |

When both a URL and a TargetSlug are set, the **TargetSlug wins**
(in-app page). This applies everywhere in this guide.

### 3.3 Page-level blocks (optional; leave the columns blank to hide each one)

| Block | Columns | Notes |
| --- | --- | --- |
| Info banner (under the hero) | `InfoBannerText` | One sentence with an info icon |
| Note banner (after the sections) | `NoteBannerText` | Warning-style sentence |
| "Ready to proceed?" row | `CtaTitle`, `CtaDescription`, `CtaLinkText` + `CtaLinkUrl`, `CtaPrimaryText` + `CtaPrimaryUrl` | Title/description on the left; the two links on the right, e.g. "Full Rules & Conditions \| Apply →". Either link may be blank. |
| Ask Policy Assistant | `SuggestedQuestions` (one per line), optionally `AssistantLinkText` + `AssistantLinkUrl` | Without a link: search box with "Try asking:" and the questions 2 per line. With a link: an "Ask a Question" button. |
| Need Help? | `NeedHelpTitle`, `NeedHelpSupportLabel`, `NeedHelpDescription`, `NeedHelpEmail` | Steps such as "Ask HR" = `TH_PolicyCards` rows with `PageId` = the page and `Kind = HelpStep` (shown in one row beside the text) |
| Closing band | `ClosingBannerTitle`, `ClosingBannerDescription`, `ClosingBadges` (one per line) | Badge icons are picked from the words: "people", "planet", "future"; anything else gets a check mark |

> For the newer pages, contact details are often better as a **Split**
> section (§4). It can hold a QR code, phone numbers and emails, which the
> fixed Need Help block can't.

---

## 4. Sections: `TH_PolicySections` and the layout catalogue

### 4.1 Columns every section has

| Column | What it does |
| --- | --- |
| `PageId` | The page (lookup). Also required for sections inside a tab. |
| `TabId` | Only for a section **inside a tab** (§8) |
| `Title` | Heading. Type `1. Title` to get a numbered badge. **Always fill it in** (§5, `HideTitle`). |
| `Subtitle` | Line under the heading. For `Search`, it's the placeholder text. |
| `Layout` | Which block this is (table below) |
| `Body` | Text. Its meaning depends on the layout (table below). |
| `Icon` | Icon before the heading, or the layout's own icon (see table) |
| `ImageUrl` | Photo, for `ImageBlock` and `Feature` |
| `LinkText` + `LinkUrl` / `TargetSlug` | Header button at the right of the heading ("View All Offers >"); a button in a `Feature` panel; the search address for `Search` |
| `DisplayOrder`, `IsActive` | Order / visibility |
| Presentation options | `SectionStyle`, `Theme`, `Width`, `Columns`, `CardStyle`, `TintCards`, `HideTitle`, `CardVariant` (§5) |

### 4.2 Layout catalogue

| Layout | Looks like (mockup example) | Content comes from |
| --- | --- | --- |
| **Paragraph** | Plain paragraphs. With an `Icon`: a card with a big icon disc on the left, title and text on the right ("Purpose", "Our Commitment", "Additional Entitlement – Extra Travel Day") | `Body`: one paragraph per line |
| **CardsGrid** | A grid of cards | Cards. `CardVariant`: `Category` (large linking cards, landing page row 1) / `Info` (small icon tiles, "Explore Policy Information") / `Highlight` (icon + title + text + SubPoints: the most flexible card) |
| **Table** | One or more data tables ("Flight Ticket Class") | `TH_PolicyTables` + rows (§7) |
| **Tabs** | A selector (pills, or rich cards when the tabs have icons) and the selected tab's content | `TH_PolicyTabs` (§8) |
| **NumberedSteps** | Rule cards with a big number badge ("Annual Flight Ticket Benefits") | Cards, `Kind = Rule`, `Number` 1, 2, 3… |
| **ProcessSteps** | Steps with arrows ("Before You Submit Your Claim"). `CardStyle = Stacked`: each step a column with number, icon circle, title and text ("How It Works", "SAP Concur Workflow Cycle") | Cards, `Kind = HelpStep`. `Number` optional; `Icon` optional. A step with only a Title is drawn compact (no box). |
| **Callout** | A tinted note box | `Body` (start with `**Label:**` for a bold label), `Icon` |
| **ImageBlock** | One photo with a caption | `ImageUrl`, `Body` = caption |
| **LinksList** | A row of link pills | Cards, `Kind = LinkItem`, `LinkText` + `LinkUrl` / `TargetSlug` |
| **Split** | Parts side by side, separated by vertical lines ("Expense Reimbursement Principles", "Need Help?" with QR code, "Important Assignment Information") | Cards, one per part: `Icon` **or** `ImageUrl` (e.g. a QR code) on the left; `Title`, `Description`, `SubPoints`, optional link. A `Kind = LinkItem` card is a compact part at the end. |
| **Checklist** | A row of green check-marked items ("Quick Compliance Check") | `Body`: one item per line |
| **Banner** | Header band: icon, title, subtitle, script tagline on the right (a tab's "Business Travel Entitlements") | `Icon`, `Title`, `Subtitle`, `Body` = tagline (one line per row), `Theme` = colour |
| **ImageCards** | Photo cards; `CardStyle` picks the look (below) | Cards: `ImageUrl`, `Title`, `Subtitle`, `Description`, `Badge`, `Value` + captions, `SubPoints`, `LinkText` + link, `Icon`, `IconColor` |
| **Feature** | One rich panel: icon disc, title and text, optional small cards, figure tiles and a photo ("Shipping Assistance", "Discover Joule", "Key Facilities") | `Icon`, `Title`, `Subtitle`, `Body` (§9.2), `ImageUrl` (photo right; `CardStyle = ImageLeft` for left), cards (a card with a `Value` = figure tile, otherwise a small info card), `LinkText` = a button |
| **Faq** | Numbered questions that expand ("Most Asked Questions") | Cards: `Title` = question, `Description` / `SubPoints` = answer. A card with only a link is a link row. |
| **Search** | Search box + "Quick links:" pills (SAP Concur) | `Subtitle` = placeholder, `LinkUrl` = search address (`{query}` is replaced by the typed words; otherwise `?q=` is added), `LinkText` = button text, `Body` = quick-links label, cards = the pills |

**ImageCards styles (`CardStyle`)**

| CardStyle | Look | Mockup examples |
| --- | --- | --- |
| `ImageTop` (default) | Photo on top with a `Badge` pill and an icon disc; then title, subtitle, text, SubPoints, `Value` ("Starting From / SAR 5,999 / per person") and a button (`LinkText`). The button is solid in `IconColor` when the card has an icon, outlined when it doesn't, and a text link when there's no photo. | Featured offers, partnered hotels, "Business Travel & Mobility", "Types of Meeting Room Setup", "What would you like to do today?" (no photo) |
| `ImageTile` | Compact tile: photo (or a big icon when there's no photo), icon disc, title and an arrow | "Explore Our Personal Travel Offers", "Key Business Travel Policy Highlights" |
| `ImageBanner` | Big photo with the text over it: `Badge` as eyebrow, title, subtitle, text, button | "Visit Red Sea / AMAALA", "Meeting Rooms at KAFD Offices" |
| `ImageLeft` | Photo or icon on the left, text and arrow on the right | "Accommodation & Site Services", "Quick Actions", "More Details / Contact HR Support" |

---

## 5. Section presentation options

All are optional. Left blank, a section looks as it always has.

| Column | Values | Effect |
| --- | --- | --- |
| `SectionStyle` | `Plain` / `Card` / `Tinted` | `Card` = white card around the section. `Tinted` = a coloured panel, colour from `Theme`. |
| `Theme` | `Gold`, `Blue`, `Green`, `Amber`, `Red`, `Purple`, `Teal` | Colour of a Tinted panel, the `1.` number badge, the header icon, a Banner, a Feature's icon disc |
| `Width` | `Full` / `Half` / `OneThird` / `TwoThirds` | Consecutive non-Full sections share a row: Half + Half, TwoThirds + OneThird, OneThird × 3. They stack on tablets and phones. |
| `Columns` | 1–6 | Cards per row on desktop (CardsGrid Highlight, ImageCards). Tablets show at most 2, phones 1. |
| `CardStyle` | `Default`, `IconHeader`, `IconMedia`, `Stacked`, `ImageTop`, `ImageLeft`, `ImageTile`, `ImageBanner` | **Highlight cards:** `IconHeader` = icon + title in one row; `IconMedia` = bigger icon in a left column. **ProcessSteps:** `Stacked`. **ImageCards:** the four image styles. **Feature:** `ImageLeft` = photo on the left. |
| `TintCards` | Yes/No | Highlight cards washed with their own `IconColor` (blue / green / purple cards) |
| `Icon` | icon name | Icon before the section heading (CardsGrid, ImageCards, Split, Checklist, ProcessSteps, Table, Faq, Tabs) |
| `Body` | text | For CardsGrid, ImageCards, ProcessSteps, Split, Tabs, Table, LinksList, Faq and NumberedSteps: a small **note box at the right of the heading**, e.g. `@Info\|These trips are paid by the company…` or `@Coffee\|One Coffee Break & Lunch Included` |
| `HideTitle` | Yes/No | Yes = `Title` is an internal name only (not shown) |

**Why `HideTitle` exists.** Cards, tables and tabs choose their parent
section through the `SectionId` lookup, which lists sections by Title. A
section with an empty Title appears as a blank option in the list form, and
saving a card there can clear its `SectionId`, so the card disappears. Give
every section a Title, and use `HideTitle = Yes` when the page shouldn't show
it.

**Numbering.** A section title typed `3. Before Making Travel Arrangements`
gets a numbered circle in the Theme colour. A Highlight card title typed
`2. Employee Responsibilities` gets one in the card's `IconColor`.

---

## 6. Cards: `TH_PolicyCards`

A card belongs to **exactly one** parent:
- **`SectionId`**: a card in a section (normal case).
- **`TabId`**: a card directly in a tab (older style; prefer sections inside tabs, §8).
- **`PageId` with `Kind = HelpStep`**: the Need Help steps.

| Column | What it does |
| --- | --- |
| `Title` | Heading. **Required** in the form. Write it in square brackets, e.g. `[Contacts]`, to hide it on the page. |
| `Kind` | `Category`, `Info`, `Highlight`, `Rule`, `HelpStep`, `LinkItem`. It matters for CardsGrid variants, NumberedSteps (Rule), ProcessSteps and Need Help (HelpStep), LinksList (LinkItem) and a Split's compact end part (LinkItem). Other layouts accept any Kind. |
| `Number` | Step or rule number |
| `Icon` | Icon name (§11). Leave blank for no icon. The opt-in styles (IconHeader, IconMedia, Split, ImageCards) only show an icon when this is filled in. |
| `IconColor` | Hex colour, e.g. `#2563eb`. Used for the icon disc, card tint (TintCards), photo-card button, badge and number badge. |
| `Description` | Main text (inline formatting, §9.3) |
| `SubPoints` | Rich multi-line content: bullets, numbers, tables, notes, icon lines (§9.1) |
| `Subtitle` | Small line under the title, e.g. "5 Nights Holiday Package", "Employee Handbook" |
| `Badge` | Pill on the photo (ImageTop) or eyebrow (ImageBanner), e.g. "Special Offer", "KAFD Offices, Riyadh" |
| `Value`, `ValueLabel`, `ValueNote` | A highlighted figure with captions: `Starting From` / `SAR 5,999` / `per person`. In a Feature it becomes a figure tile, e.g. `Up to` / `SAR 25,000` / `Shipping Assistance`. |
| `ImageUrl` | Photo (ImageCards), QR code (Split part), screenshot (Stacked step) |
| `TargetSlug` | Opens an in-app page (wins over LinkUrl) |
| `LinkUrl` + `OpenInNewTab` | External link. Web links usually need `OpenInNewTab = Yes`. `mailto:` works. |
| `LinkText` | Button or link text: "View Details", "Get Started", "View Gallery" |

**Which columns each layout reads**

| Layout | Title | Descr. | SubPoints | Icon | IconColor | Image | Badge | Value | Link |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| CardsGrid Highlight | ✔ | ✔ | ✔ | ✔ | ✔ | | tag `%%` | | ✔ (IconHeader/IconMedia) |
| CardsGrid Category / Info | ✔ | ✔ / — | | ✔ | ✔ | | | | ✔ |
| NumberedSteps | ✔ | ✔ | ✔ | ✔ | ✔ | | | | |
| ProcessSteps | ✔ | ✔ | ✔ (Stacked) | ✔ | ✔ | ✔ (Stacked) | | | |
| Split | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | | | ✔ |
| ImageCards | ✔ | ✔ | ✔ (ImageTop) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Feature | ✔ | ✔ | ✔ | ✔ | ✔ | | | ✔ | ✔ |
| Faq | ✔ | ✔ | ✔ | | | | | | ✔ |
| LinksList / Search pills | ✔ | | | ✔ | | | | | ✔ |

---

## 7. Tables: `TH_PolicyTables` and `TH_PolicyTableRows`

For a `Table` section:

1. Add a `TH_PolicyTables` row:
   - `SectionId` = the section.
   - `Title` (optional sub-heading).
   - `ColumnHeaders`: one header per line.
2. Add a `TH_PolicyTableRows` row per table row:
   - `TableId` = the table.
   - `CellValues`: one value per line, in the header order.

**Icons in tables.** Write `IconName::Text` in the **first column** or in a
**header**, e.g. `MapPin::GCC Countries` or `Clock::Flights up to 6 hours`.
Cells also accept inline formatting (§9.3).

**Small tables inside a card.** Use the SubPoints `##` table (§9.1) instead:
- Header line: `##Travel Type|Submit Request`.
- Each row: `GCC Countries|At least 5 business days before travel`.

That's usually easier, because the table lives in the same card as its intro
text and notes.

---

## 8. Tabs: `TH_PolicyTabs`

Example: Travel Entitlement, "Business Travel | Business Assignment".

1. **Selector.** Add a section with `Layout = Tabs` and a `Title`/`Subtitle` such as "Select Your Travel Type". `SectionStyle = Card` is optional.
2. **One `TH_PolicyTabs` row per tab.** Set `SectionId` = the Tabs section, `Title` = tab label and `DisplayOrder`.
   - Fill `Icon`, `Subtitle` ("Less than 30 days") and `Description` to get the rich selector cards (icon, text, arrow).
   - Without an Icon, the tabs are plain pills.
3. **Information bar under the selector (optional).** Add cards with `SectionId` = the **Tabs section itself**. They render as a Split bar, e.g. "Not sure which category applies?" plus a `LinkItem` card "Need help deciding? / Contact Travel Services".
4. **Tab content.** Add ordinary sections with **`TabId` = that tab** and `PageId` = the page, in `DisplayOrder`. Anything works, e.g.:
   - a `Banner` (the header that changes with the tab),
   - a `CardsGrid` with 4 cards,
   - a `Paragraph` with an icon,
   - a `Split` row.

   Widths also work inside tabs.

---

## 9. Writing text: SubPoints, Body and inline formatting

### 9.1 SubPoints (card content)

Each line is one item, and blocks appear **in the order you write them**.

| Write the line as | Renders as |
| --- | --- |
| `Plain text` | Bullet point |
| `1. Text` / `2) Text`… (a run where every line is numbered) | Numbered points with coloured circles |
| `==Sub-heading` | Small bold heading above what follows |
| `~~Plain paragraph` | Paragraph (no bullet) |
| `##Header 1\|Header 2\|…` | Starts a mini table (header row). Headers may use `Icon::Text`. |
| `Cell 1\|Cell 2\|…` (directly after `##` or another row) | Table row. First cell may use `Icon::Text`. |
| `!!Label:\|Text` or `!!Text` | Info note box, optional bold label |
| `@IconName\|Sub-heading\|Description` | Icon + bold sub-heading + text |
| `@IconName\|Text` | Bullet with its own icon (contact lines, checklists) |
| `%%Tag` (anywhere) | A tag pill in the card header, e.g. `Traveler` |

Example (a Travel Entitlement card):

```
==Standard Travel Class
##Job Grade|< 6 flying hours (Zone 1)|> 6 flying hours (Zone 2)
Grades 12 – 14|Business Class|Business Class
Grades 1 – 11|Economy Class|Business Class
~~If the eligible travel class is unavailable, an upgrade is subject to approval.
@Suitcase|Excess Baggage|Covered only when required for a business purpose.
```

### 9.2 Body in a Feature section, and the header note

These use the same markers, with one difference: **a plain line is a
paragraph**. Bullets are written with `- ` or `• ` at the start.

```
Once the mobilization date is confirmed, book your relocation flight through SAP Concur.
- You will be eligible for reimbursement of shipment expenses.
- Pro-forma invoices and cash payments are not accepted.
!!In case of unavailability of the eligible travel class, an upgrade may be approved by HR.
```

### 9.3 Inline formatting (descriptions, bullets, table cells, callouts)

- `**bold**` shows as **bold**.
- An email address becomes a mail link.
- `https://…` becomes a link that opens in a new tab.
- A phone number starting with `+` becomes a call link, e.g. `+966 11 413 6116`.

No HTML is ever inserted, so pasting HTML shows it as plain text.

**Pasting from Word or PDF.** Replace tab characters between table cells
with `|`. Bullets pasted as "•" work in Feature text; in card SubPoints just
remove them, since every plain line is already a bullet.

---

## 10. Navigation and links

- **Card to page.** `TargetSlug` = the page's Slug. `TargetSlug = business-travel` opens the Business Travel page.
- **Card to website.** `LinkUrl`, plus `OpenInNewTab = Yes` for external sites. `mailto:` links are fine.
- **Header button, Feature button or search address.** The section's `LinkText` + `LinkUrl` / `TargetSlug`.
- **Hero buttons.** Page columns `HeroLinkText`… (§3.2).
- **Top navigation tabs.**
  - Tabs come from `TH_TravelServices`, plus Home, Travel Policy, Help Desk and Travel Care, plus `TH_GlobalNavigation`.
  - To make a service's tab (and its "Explore Our Travel Services" card) open a page, set **`TH_TravelServices.PageSlug`** = the page Slug, e.g. `sap-concur`.
  - Leave it blank to keep the old service screen.
- **Business Travel.** Its tab opens the `TH_PolicyPages` row with Slug `business-travel` when that row exists and is active. Otherwise it opens the original Business Travel screen.
- **Which tab is highlighted.** A tab with PageSlug `sap-concur` lights up on `sap-concur` and on every page whose Slug **starts with** `sap-concur-` (so name sub-pages `sap-concur-plan-book` etc.). Every other page highlights Travel Policy.
- **Breadcrumb.** `ParentSlug` / `ParentTitle` (§3.1).

---

## 11. Images, icons and colours

**Images**

- **Where to upload.** Put them in the site's **Travel Hub Images** library and copy the file's link into `ImageUrl` / `HeroImageUrl`.
- **Sizes.**

  | Image | Size |
  | --- | --- |
  | Hero | about 1600 × 500 |
  | ImageTop / ImageTile card | about 600 × 400 |
  | ImageBanner | about 1100 × 500 |
  | Feature photo | about 600 × 450 |
  | QR code | a square PNG |

  Photos are cropped to fit, so keep the subject in the centre.
- **Sample data** uses placeholder photos (picsum.photos) and placeholder QR codes (api.qrserver.com). Replace them before go-live.

**Icons.** Use Fluent UI MDL2 icon names, which are case-sensitive, e.g.
`Airplane`, `Hotel`, `Car`, `Money`, `Calendar`, `Page`, `People`, `Mail`,
`Headset`, `Phone`, `Chat`, `Globe`, `MapPin`, `Suitcase`, `Shield`,
`CheckMark`, `Search`, `System`, `CellPhone`, `ReceiptCheck`,
`DocumentApproval`, `Lightbulb`, `Robot`, `Sunny`, `EatDrink`, `Coffee`,
`Library`, `Settings`, `Sync`, `Cancel`, `Warning`, `Info`,
`BullseyeTarget`, `Family`, `Home`, `Package`, `Ticket`, `Clock`.

- The full list is at https://developer.microsoft.com/fluentui#/styles/web/icons.
- A misspelled or unknown name shows an **empty circle**. `Bed`, `Leaf` and `Receipt` are *not* valid.

**Colours**

- **`IconColor`** takes any hex colour. The palette used across the pages:

  | Colour | Hex |
  | --- | --- |
  | Blue | `#2563eb` |
  | Green | `#16a34a` |
  | Amber | `#d97706` |
  | Red | `#dc2626` |
  | Purple | `#7c3aed` |
  | Teal | `#0d9488` |
  | Pink | `#e11d48` |
  | Navy | `#1e3a8a` |

- **`Theme`** (sections) uses the named colours in §5.

---

## 12. Day-to-day editing

- **Edit** the row and **refresh the Travel Hub page**; the change shows immediately. A browser tab that stays open without a refresh keeps its copy for up to 10 minutes.
- **Quick Edit.** SharePoint's grid view is the fastest way to change many cards or table rows at once.
- **Hide** with `IsActive = No`; delete only when you're sure.
- **Reorder** with `DisplayOrder`. Numbering in 10s (10, 20, 30…) lets you insert blocks later without renumbering.
- **Move a card** to another section by changing its `SectionId`.
- **Test on a phone width.** Side-by-side sections and card rows stack automatically, but very long titles in 5–6 column rows wrap.
- **Before publishing a new page:**
  1. Open every card link.
  2. Check that there are no empty icon circles.
  3. Check the breadcrumb.
  4. Check the page on the Dark theme (top-bar theme menu).

---

## 13. Recipes: mockup pattern → configuration

| You want… | Configure |
| --- | --- |
| Hero with icon disc and photo on the right | Page `HeroStyle = Light`, `HeroIcon`, `HeroEyebrow`, `HeroTitle`, `HeroSubtitle`, `HeroDescription`, `HeroImageUrl`, `HeroTagline` |
| Hero buttons ("Access SAP Concur") | Page `HeroLinkText` + `HeroLinkUrl` (and `HeroLink2…`) |
| Feature strip under the hero ("Right process \| Clear guidance \| Dedicated support") | `Split`, `SectionStyle = Card`, one card per item (`Icon`, `Title`, `Description`) |
| "Purpose" / "Our Commitment" icon card | `Paragraph`, `Icon = BullseyeTarget`, `SectionStyle = Card`, `Theme = Blue` |
| Coloured note panel ("Business Travel + Annual Vacation") | `Paragraph`, `Icon`, `SectionStyle = Tinted`, `Theme = Amber` |
| Two comparison cards ("Which Policy Applies?") | `CardsGrid` Highlight, `Columns = 2`, `CardStyle = IconHeader`, `TintCards = Yes`; SubPoints with `@Calendar\|…\|…` and `!!Important:\|…` |
| 3 principle cards per row | `CardsGrid` Highlight, `Columns = 3`, `TintCards = Yes` |
| Numbered card holding a table and a note ("1. Plan Before You Travel") | Highlight card titled `1. …`, SubPoints `~~intro`, `##…` table, `!!note` |
| Big-icon cards in a tinted panel ("3. Before Making Travel Arrangements") | `CardsGrid`, `CardStyle = IconMedia`, `Columns = 3`, `SectionStyle = Tinted`, `Theme = Purple`, title `3. …` |
| Travel type selector with per-tab content | §8 |
| Parts separated by vertical lines | `Split` |
| Steps with icons in one row ("Before You Submit Your Claim") | `ProcessSteps`; cards with `Number` + `Icon` |
| Step columns with number, icon, text ("How It Works") | `ProcessSteps`, `CardStyle = Stacked` |
| Two processes side by side | Two `ProcessSteps` sections, `Width = Half` each |
| Table beside a panel | `Table` `Width = TwoThirds` + `Feature` `Width = OneThird` |
| Green check-mark row | `Checklist`, `Body` one item per line |
| Photo cards with price and button | `ImageCards`, `CardStyle = ImageTop`; cards `ImageUrl`, `Badge`, `Subtitle`, `ValueLabel`/`Value`/`ValueNote`, `LinkText` + link |
| Category photo tiles with icon and arrow | `ImageCards`, `CardStyle = ImageTile` |
| Icon tiles with arrow ("Key … Highlights") | `ImageCards`, `CardStyle = ImageTile`, cards without `ImageUrl` |
| Destination / meeting-room banners | `ImageCards`, `CardStyle = ImageBanner`, `Columns = 1` or `2` |
| Link cards ("More Details", "Quick Actions") | `ImageCards`, `CardStyle = ImageLeft` |
| Text + figure tile + photo ("Shipping Assistance – Up to SAR 25,000") | `Feature`, `Icon`, `Body`, `ImageUrl`; a card with `ValueLabel`/`Value`/`ValueNote` |
| Heading note ("These trips are paid by the company…") | Section `Body = @Info\|These trips…` on a CardsGrid / ImageCards / Split… section |
| "View All Offers >" at the right of a heading | Section `LinkText` + `LinkUrl` / `TargetSlug` |
| Contact block with QR, phones, emails | `Split`: a card with `ImageUrl` = QR; a card with SubPoints `@Phone\|Call +966…`, `@Mail\|Email name@…` |
| FAQ | `Faq`, cards `Title` = question, `Description` = answer |
| Search box with quick links | `Search`: `Subtitle` placeholder, `LinkUrl` with `{query}`, `LinkItem` cards |

---

## 14. Administrator tasks

All scripts run from the browser console on the Travel Hub site. Check
`CONFIG.TARGET_WEB_URL` at the top of each script.

| Task | How |
| --- | --- |
| Create lists and columns, or **add new columns / layout choices after an upgrade** | Run `provisioning/travelhub-provision.js`. It only adds what's missing and never deletes data. Step 4b adds new `Layout` and `CardStyle` choices to existing columns. |
| Load demo content into an empty site | `provisioning/travelhub-sample-data.js` with default settings |
| **Rebuild specific pages from the sample content** (existing site) | In `travelhub-sample-data.js`, set `CONFIG.RESEED_SLUGS` to the pages' Slugs, e.g. `['business-travel', 'sap-concur']`, and run it. Each listed page and everything under it is deleted and recreated. **Edits made to those pages are replaced; nothing else is touched.** It also fills `TH_TravelServices.PageSlug` for Personal Travel Offers, SAP Concur and Meeting(s) & Events if still empty. |
| Name untitled sections and find orphaned cards | `provisioning/travelhub-fix-section-titles.js` (report only by default; set `DRY_RUN: false` to apply) |
| Deploy code changes | Raise `version` in `config/package-solution.json`, `npm run build`, upload `sharepoint/solution/travel-hub.sppkg` to the App Catalog (replace), then **Deploy** |

All 18 sample pages (Slugs for `RESEED_SLUGS`):
- `travel-policy`, `annual-flight-ticket-benefits` (built with the landing
  data; not in the re-seed list)
- `purpose-scope`, `guiding-principles`, `travel-planning-approvals`,
  `travel-entitlement`, `expenses`, `compliance-responsibilities`
- `business-travel`, `employee-relocation`, `family-relocation`
- `personal-travel-offers`, `meetings-events`
- `sap-concur`, `sap-concur-plan-book`, `sap-concur-review-approve`,
  `sap-concur-claim-expense`, `sap-concur-mobile`

---

## 15. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| A card disappeared after editing it | Its `SectionId` was cleared because the section has no Title. Give the section a Title (+ `HideTitle = Yes`) and re-select the card's `SectionId`. The fix script lists such cards. |
| A table shows as bullets | The `##` header line is missing, or cells are separated by tabs instead of `\|` |
| Numbers show as bullets | Every line in the run must start `1.` / `2.` …; a plain line in between breaks the run |
| Empty icon circle | Icon name misspelled, not an MDL2 name, or wrong case |
| New layout / CardStyle not in the dropdown | Run `travelhub-provision.js` (step 4b adds the choices) |
| Page shows "This policy page isn't available" | Slug typo, `IsActive = No`, or the page row is missing |
| A service tab still opens the old screen | `TH_TravelServices.PageSlug` is empty or misspelled |
| Business Travel still shows the old screen | No active `TH_PolicyPages` row with Slug `business-travel` |
| Sections don't sit side by side | Their `Width` values add up to more than a full row, a Full section sits between them, or you're on a tablet/phone (they stack by design) |
| A photo is blank | The link isn't a direct file URL, or the viewer has no access to the library |
| An edit doesn't show | Refresh the page (the open page keeps its copy for up to 10 minutes) |
