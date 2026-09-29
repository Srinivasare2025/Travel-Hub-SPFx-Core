# TravelHub – Data Model

## What this is

The canonical TypeScript interfaces the service layer returns and the components
consume. Components depend on **these**, never on SharePoint field names. All
interfaces live in `src/models/` (one file each, barrel-exported from
`index.ts`), created in Phase 2.

## Conventions

- Interface names are `I{Entity}`. Enums are `T{Name}` string-literal unions where
  practical (smaller bundle, easier to serialise) or `enum` when a stable numeric
  contract is needed.
- Dates are exposed as JavaScript `Date` (parsed in the service from ISO), not
  strings. Formatting happens in the component via `formatDate`.
- URLs are exposed **already validated** by the service (`isSafeUrl`). A rejected
  URL becomes `undefined`, and the component hides the affected affordance.
- Every model has `id: number` (SharePoint item id) and, where ordered,
  `displayOrder: number`.
- Optional fields are `?`, never `null`. Services normalise `null` → `undefined`
  (aligns with the `@rushstack/no-new-null` lint rule).

## `any` policy

`any` is banned. Allowed only with an inline `// any: <reason>` comment in these
known cases:

1. The raw PnPjs item shape immediately before mapping — typed as a local
   `RawXItem` interface instead wherever the columns are known (preferred).
2. `JSON.parse` results that are immediately validated by a type guard.

No other `any`. `unknown` + narrowing is the default for genuinely dynamic data.

---

## Core content models

### `IHeroBanner`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| title | `string` | |
| description | `string` | plain text |
| mediaType | `'image' \| 'video'` | |
| imageUrl | `string` | desktop image (required for `image`) |
| mobileImageUrl | `string \| undefined` | falls back to `imageUrl` |
| videoUrl | `string \| undefined` | required for `video`; muted, no autoplay-with-sound |
| accessibilityText | `string` | `alt` / `aria-label` for the slide |
| displayOrder | `number` | |
| autoPlay | `boolean` | per-slide |
| durationSeconds | `number` | dwell time before advancing |
| isActive | `boolean` | |
| startDate | `Date \| undefined` | window start |
| endDate | `Date \| undefined` | window end |

### `IHeroQuickLink` (config-driven, from `TH_SiteConfiguration` or a small list)
| Field | Type | Notes |
| --- | --- | --- |
| key | `'helpDesk' \| 'travelCare'` | |
| title | `string` | e.g. "Help Desk" |
| description | `string` | e.g. "General travel guidance and non-urgent assistance" |
| url | `string` | validated |
| openInNewTab | `boolean` | |
| badgeText | `string \| undefined` | e.g. "24/7" |
| isActive | `boolean` | |

### `ITravelService`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| title | `string` | |
| description | `string` | |
| imageUrl | `string` | |
| icon | `string` | Fluent icon name or asset key |
| iconBackgroundColor | `string` | hex/token; validated to a safe CSS color |
| linkUrl | `string` | validated |
| linkType | `'internal' \| 'external'` | |
| openInNewTab | `boolean` | |
| linkText | `string \| undefined` | "Learn More" / "Explore Offers" etc.; default from config |
| displayOrder | `number` | |
| isActive | `boolean` | |
| startDate / endDate | `Date \| undefined` | window |

### `ITravelNews`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| title | `string` | |
| description | `string` | |
| imageUrl | `string \| undefined` | |
| publishDate | `Date` | |
| linkType | `'internal' \| 'external' \| 'onPremReference'` | |
| targetUrl | `string` | validated; `onPremReference` = a stored absolute URL to the legacy farm, shown with an indicator |
| category | `string \| undefined` | |
| openInNewTab | `boolean` | |
| displayOrder | `number` | |
| isActive | `boolean` | |
| isFeatured | `boolean` | derived: first by (isFeatured desc, displayOrder, publishDate desc) |

### `ITravelEvent`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| title | `string` | |
| description | `string` | |
| eventDate | `Date` | |
| startTime / endTime | `string \| undefined` | display strings ("09:00") or derived from datetime |
| location | `string \| undefined` | |
| category | `string \| undefined` | badge |
| imageUrl | `string \| undefined` | |
| registrationUrl | `string \| undefined` | validated |
| displayOrder | `number` | |
| isActive | `boolean` | |

### `ITravelTip`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| title | `string` | the tip text |
| description | `string \| undefined` | optional expansion |
| icon | `string` | |
| category | `string \| undefined` | |
| linkUrl | `string \| undefined` | validated |
| displayOrder | `number` | |
| isActive | `boolean` | |

---

## Engagement models

### `IQuickPulseQuestion`
| Field | Type |
| --- | --- |
| id | `number` |
| question | `string` |
| isActive | `boolean` |
| startDate / endDate | `Date \| undefined` |
| allowComments | `boolean` |
| oneResponsePerUser | `boolean` |

### `IQuickPulseOption`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| questionId | `number` | lookup |
| title | `string` | e.g. "Excellent" |
| icon | `string` | emoji or icon key |
| value | `number` | ordinal (5..1) for aggregation |
| displayOrder | `number` | |
| isActive | `boolean` | |

### `IQuickPulseResponseInput` (write model)
| Field | Type |
| --- | --- |
| questionId | `number` |
| responseValue | `number` |
| comments | `string \| undefined` |

### `IQuickPulseAggregate` (read model — admin/permitted only)
| Field | Type | Notes |
| --- | --- | --- |
| questionId | `number` | |
| totalResponses | `number` | |
| breakdown | `{ value: number; count: number; percent: number }[]` | no per-user data |
| userHasResponded | `boolean` | for the current user, to drive UI state |

> Normal users receive **only** `userHasResponded` (and, if the business allows,
> `IQuickPulseAggregate` without comments). Raw `TH_QuickPulseResponses` rows are
> never sent to the client for non-reporting users. See SECURITY.md.

### `ITravelerTestimonial`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| personName | `string` | |
| profileImageUrl | `string \| undefined` | |
| rating | `number` | 1–5 |
| comment | `string` | |
| designation | `string \| undefined` | |
| department | `string \| undefined` | |
| location | `string \| undefined` | |
| personInfoLine | `string \| undefined` | **explicit override** for the ambiguous mock line; if set, rendered verbatim; else composed from a config template (see ASSUMPTIONS) |
| displayOrder | `number` | |
| isActive | `boolean` | |

---

## Insights models

### `ITravelSpend` (returned by `ITravelSpendService`)
| Field | Type | Notes |
| --- | --- | --- |
| department | `string` | |
| period | `string` | e.g. "2024-Q1" — label only, no calculation |
| currency | `string` | ISO 4217 |
| totalSpend | `number` | |
| airSpend | `number` | |
| hotelSpend | `number` | |
| groundTransportSpend | `number` | |
| bookingSpend | `number` | |
| dashboardUrl | `string \| undefined` | validated external link |
| source | `'sharepoint' \| 'powerbi' \| 'concur' \| 'api' \| 'warehouse'` | provenance for display/debug |

### `ITravelSpendAccess`
| Field | Type |
| --- | --- |
| hasAccess | `boolean` |
| reason | `'granted' \| 'not-in-group' \| 'no-department' \| 'source-denied'` |

### `IGreenTravel`
| Field | Type |
| --- | --- |
| id | `number` |
| title | `string` |
| description | `string` |
| points | `string[]` |
| imageUrl | `string` |
| linkUrl | `string \| undefined` |
| linkText | `string \| undefined` |
| isActive | `boolean` |

### `ITravelTeamMember`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| name | `string` | |
| designation | `string` | |
| department | `string \| undefined` | |
| specialization | `string \| undefined` | |
| profileImageUrl | `string \| undefined` | |
| email | `string \| undefined` | rendered as `mailto:` only |
| phone | `string \| undefined` | rendered as `tel:` only |
| location | `string \| undefined` | |
| displayOrder | `number` | |
| isActive | `boolean` | |

---

## Footer models

### `IFooterColumn`
| Field | Type |
| --- | --- |
| id | `number` |
| title | `string` |
| displayOrder | `number` |
| isActive | `boolean` |
| links | `IFooterLink[]` (composed by the service) |

### `IFooterLink`
| Field | Type | Notes |
| --- | --- | --- |
| id | `number` | |
| columnId | `number` | lookup |
| title | `string` | |
| url | `string` | validated |
| icon | `string \| undefined` | |
| openInNewTab | `boolean` | |
| displayOrder | `number` | |
| isActive | `boolean` | |

---

## Configuration model

### `ITravelHubConfiguration`
```ts
interface ITravelHubConfiguration {
  brandName: string;                         // display name (mock shows "RSG")
  hero: {
    autoPlay: boolean;
    intervalSeconds: number;                 // fallback when a slide has no duration
    supportingMessage: string;
  };
  services: ResponsiveCounts & { defaultLinkText: string };
  testimonials: {
    autoPlay: boolean;
    intervalSeconds: number;
    personInfoTemplate: string;              // e.g. "{designation} – {location}"
  } & ResponsiveCounts;
  team: { landingPageCount: number; viewAllUrl: string };
  dates: { locale: string; showHijri: boolean };
  sections: Record<TSectionKey, { isVisible: boolean; title?: string }>;
  viewAllUrls: Record<'news' | 'events' | 'tips' | 'testimonials', string>;
  featureFlags: Record<string, boolean>;
}

interface ResponsiveCounts {
  desktopVisibleCards: number;
  tabletVisibleCards: number;
  mobileVisibleCards: number;
}

type TSectionKey =
  | 'hero' | 'travelServices' | 'travelUpdates' | 'travelerEngagement'
  | 'travelInsights' | 'travelTeam' | 'footer';
```

Values come from `TH_SiteConfiguration` (key/value rows) merged over hard-coded
**safe defaults** in `ConfigurationService`. See CONFIGURATION.md for the key
list and precedence.

---

## Mapping rules (service responsibility)

1. `select()` only the columns listed here — never `*`.
2. Parse SharePoint date strings → `Date`; invalid → `undefined` (or drop the row
   if the date is required, e.g. events).
3. Run every URL through `isSafeUrl`; unsafe → `undefined`.
4. Coerce SharePoint `Yes/No` → `boolean`.
5. Apply the active/date-window filter **server-side** in `filter()` where
   possible; re-check client-side only for date windows OData can't express
   cleanly.
6. Sort by `displayOrder` then a sensible secondary key.
7. Never leak internal fields (author, editor, etc.) into the model.
