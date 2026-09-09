# TravelHub – Configuration

## What this is and why it exists

Every behaviour the business might want to change without a code deploy —
carousel counts, autoplay intervals, "View All" targets, section visibility,
feature flags, brand name, date/Hijri display — is a configuration value read
from the `TH_SiteConfiguration` list. React components consume
`ITravelHubConfiguration`; they never hard-code these decisions.

## How it works

```
TH_SiteConfiguration (key/value rows)
        │  read once in TravelHubWebPart.onInit()
        ▼
ConfigurationService.getConfiguration()
        │  1. start from DEFAULTS (hard-coded, always valid)
        │  2. overlay each active row: parse ConfigValue by ValueType
        │  3. validate (ranges, enums, URL safety); invalid → keep default + Log.warn
        ▼
ITravelHubConfiguration  (typed object)
        │  passed down as data via ServiceContext / props
        ▼
Sections read config.<area>.<key>   (no list access)
```

**Precedence:** hard-coded default → `TH_SiteConfiguration` row → (future)
per-web-part property-pane override for a small set of keys. A missing or invalid
row never breaks the page — the default wins and a warning is logged.

## Property pane vs list

- **List** = the source of truth for content-team-managed settings (all keys
  below).
- **Property pane** = reserved for *instance* choices a page author makes when
  placing the web part (e.g. "use configuration set A vs B", or an environment
  banner). Kept deliberately minimal. The existing `description` property will be
  repurposed/removed in Phase 4.

## Key catalogue

`Title` column = key. `ValueType` drives parsing. All keys are optional (default
shown).

### Brand & layout
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `brand.name` | string | `RSG` | Footer, Quick Pulse copy, aria labels |
| `layout.fullBleed` | boolean | `true` | `TravelHub` root — breaks the web part out of SharePoint's centred canvas to the full viewport width and removes the inner content max-width. On a live page it also hides the SharePoint suite/command bar and neutralizes the canvas's zone/section/control-zone wrappers (`chromeOverride.ts`, `:has()`-scoped to this web part) for every visitor of that page. See DEPLOYMENT.md "Full-width page" for the page setup this expects and the trade-offs. Set `false` to keep the site chrome and sit inside a normal centred section. |

### Theme
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `theme.canvas` | enum `sky` \| `cream` \| `dark` | `sky` | `TravelHub` root (`data-th-canvas`) — the page canvas palette (`src/common/styles/_tokens.scss`). `sky` is the standard light theme, `cream` a warm ivory alternative, `dark` a dark navy canvas with light text. The gold/navy brand colours (buttons, links, the hero's own photo-overlay chrome) stay constant across all three — only backgrounds, borders, and card/section text swap, so nothing loses contrast in any theme. |

### Hero
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `hero.autoPlay` | boolean | `true` | HeroCarousel |
| `hero.intervalSeconds` | number (3–20) | `6` | HeroCarousel — how long each **image** slide is shown before advancing. Video slides ignore it and advance when the video finishes playing (`TH_HeroBanners.DurationSeconds`, 3–600s, is unused for video). |
| `hero.supportingMessage` | string | `Travel Care — Your Partner in Every Journey` | HeroQuickLinks |
| `hero.quickLinks.layout` | enum `inline` \| `stack` | `inline` | `inline` = the two cards on one row (side by side); `stack` = a narrow single-column list |
| `hero.quickLink.helpDesk.title` | string | `Travel Services Help Desk` | HeroQuickLinks |
| `hero.quickLink.helpDesk.description` | string | `General travel guidance and non-urgent assistance` | " |
| `hero.quickLink.helpDesk.url` | string (safe URL) | `#` | destination — a page |
| `hero.quickLink.helpDesk.type` | enum `page` \| `image` | `page` | `page` = normal link; `image` = the URL is an image and opens in an **in-app image viewer** (the file URL never appears in the address bar, so viewers aren't dropped into the document library) |
| `hero.quickLink.helpDesk.openInNewTab` | boolean | `true` | new tab — applies to `type: page` only (`image` always opens the in-app viewer) |
| `hero.quickLink.travelCare.title` | string | `Travel Care 24/7` | " |
| `hero.quickLink.travelCare.description` | string | `Urgent support anytime, anywhere` | " |
| `hero.quickLink.travelCare.url` | string (safe URL) | `#` | destination — **an image URL** (poster with QR codes) by default |
| `hero.quickLink.travelCare.type` | enum `page` \| `image` | `image` | opens the poster in the in-app image viewer (zoom + close) so the viewer can scan its QR codes without leaving the page |
| `hero.quickLink.travelCare.badgeText` | string | `24/7` | " |
| `hero.quickLink.travelCare.openInNewTab` | boolean | `true` | open in a new tab/window |

### Travel Services
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `services.desktopVisibleCards` | number (2–8) | `4` | TravelServicesCarousel |
| `services.tabletVisibleCards` | number (1–4) | `2` | " |
| `services.mobileVisibleCards` | number (1–2) | `1` | " |
| `services.defaultLinkText` | string | `Learn More` | TravelServiceCard (when a row has no `LinkText`) |
| `services.autoPlay` | boolean | `true` | TravelServicesCarousel auto-advances, same as the hero |
| `services.intervalSeconds` | number (3–20) | `5` | " |

### Travel Updates – View All
| Key | Type | Default |
| --- | --- | --- |
| `viewAll.news.text` / `viewAll.news.url` | string / safe URL | `View All` / `#` |
| `viewAll.events.text` / `viewAll.events.url` | string / safe URL | `View All` / `#` |
| `viewAll.tips.text` / `viewAll.tips.url` | string / safe URL | `View All` / `#` |
| `updates.news.count` | number (2–8) | `4` |
| `updates.events.count` | number (1–3) | `3` — business rule: at most 3 upcoming events show on the hub page, the rest are behind "View All" |
| `updates.tips.count` | number (3–12) | `7` |

### Testimonials
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `testimonials.autoPlay` | boolean | `true` | TravelerTestimonialsCarousel |
| `testimonials.intervalSeconds` | number (4–20) | `8` | " |
| `testimonials.desktopVisibleCards` | number (1–4) | `3` | " |
| `testimonials.tabletVisibleCards` | number (1–3) | `2` | " |
| `testimonials.mobileVisibleCards` | number (1–2) | `1` | " |
| `testimonials.personInfoTemplate` | string | `{designation} – {location}` | composes the ambiguous line when a row has no explicit `PersonInfoLine` (see ASSUMPTIONS) |
| `viewAll.testimonials.text` / `.url` | string / safe URL | `View All Stories` / `#` — **not currently read by the UI**: "View All Stories" always navigates in-app to `ViewAllFeedbackScreen` (COMPONENTS.md §3.4) rather than this external URL. Kept resolved for possible future re-use. |

### Quick Pulse
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `quickPulse.showAggregateResults` | boolean | `false` | QuickPulseCard "View Previous Results" visibility for non-admins |
| `quickPulse.confirmationMessage` | string | `Thanks — your feedback has been recorded.` | QuickPulseCard |
| `quickPulse.pulseAdminGroup` | string | `TravelHub Pulse Admins` | QuickPulseService access check |

### Department Spend
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `spend.viewerGroup` | string | `TravelHub Spend Viewers` | TravelSpendService access check (SharePoint impl) |
| `spend.source` | enum `sharepoint\|powerbi\|concur\|api\|warehouse` | `sharepoint` | which `ITravelSpendService` implementation is wired |
| `spend.dashboardUrl` | string (safe URL) | `#` | fallback "View Travel Dashboard" link |
| `spend.deniedMessage` | string | mock's message | DepartmentTravelSpendCard forbidden state |

### Green Travel / Team / Footer
| Key | Type | Default |
| --- | --- | --- |
| `team.landingPageCount` | number (2–8) | `4` |
| `team.viewAllUrl` | string (safe URL) | `#` |
| `team.viewAllText` | string | `View All Team Members` |
| `footer.showQrCode` | boolean | `false` |
| `footer.qrCodeUrl` | string (safe URL) | `` |
| `footer.legalText` | string | `© {year} {brand}. All rights reserved.` |
| `footer.lastUpdatedText` | string | `` (optional manual "Last Updated" line) |

### Dates
| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `dates.locale` | string (BCP-47) | `en-GB` | all date formatting |
| `dates.showHijri` | boolean | `false` | events/news date display |
| `dates.hijriLocale` | string | `ar-SA-u-ca-islamic-umalqura` | Hijri formatting |

### Section visibility
| Key | Type | Default |
| --- | --- | --- |
| `sections.hero.isVisible` | boolean | `true` |
| `sections.travelServices.isVisible` | boolean | `true` |
| `sections.travelUpdates.isVisible` | boolean | `true` |
| `sections.travelerEngagement.isVisible` | boolean | `true` |
| `sections.travelInsights.isVisible` | boolean | `true` |
| `sections.travelTeam.isVisible` | boolean | `true` |
| `sections.footer.isVisible` | boolean | `true` |
| `sections.<key>.title` | string | per-section default heading |

> Section visibility controls **rendering**, not authorisation. Hiding
> `travelInsights` does not protect spend data — that is enforced at the source
> (SECURITY.md).

### Feature flags
| Key | Type | Default | Purpose |
| --- | --- | --- | --- |
| `featureFlags.heroVideo` | boolean | `true` | allow `MediaType = Video` slides |
| `featureFlags.newsOnPremLinks` | boolean | `true` | allow `LinkType = OnPremReference` |
| `featureFlags.rtl` | boolean | `false` | future Arabic/RTL layout (Phase: enhancement) |
| `featureFlags.<name>` | boolean | `false` | generic switch namespace |

## Adding a new setting (developer recipe)

1. Add the key + type + default to `ConfigurationService` `DEFAULTS` and to
   `ITravelHubConfiguration`.
2. Add validation (range/enum/URL) in the service.
3. Add a row to this catalogue.
4. Consume `config.<area>.<key>` in the component. Do **not** read the list.
5. Add a unit test: missing row → default; bad value → default + warning; good
   value → parsed.

## Editor recipe (no code)

1. Open `TH_SiteConfiguration`.
2. New item: `Title` = the key, `ConfigValue` = the value, `ValueType` = matching
   type, `IsActive` = Yes.
3. Reload the page (values are cached ~10 min).
