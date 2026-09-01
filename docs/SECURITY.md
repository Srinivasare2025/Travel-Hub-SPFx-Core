# TravelHub – Security

## What this is and why it exists

TravelHub renders on a SharePoint page inside the user's authenticated session.
The security work is therefore about **not weakening** what SharePoint already
enforces, protecting two sensitive data sets (Quick Pulse responses, department
spend), and handling untrusted content (editor-entered URLs and text). This
document is the checklist the Phase 12 hardening pass verifies against.

## 1. Identity & permissions

- The web part runs as the signed-in user. All PnPjs calls inherit that user's
  SharePoint permissions — a user who cannot read a list gets a 403 and the
  section shows a friendly `ErrorState`, never a stack trace.
- **No app-only auth, no client secrets, no certificates** in the SPFx bundle.
  SPFx cannot hold secrets — anything shipped in the bundle is public to any
  page viewer.
- Microsoft Graph is used only where genuinely required (e.g. current user's
  department for spend gating). Graph scopes are requested via
  `package-solution.json` `webApiPermissionRequests` and must be approved by an
  admin in the API access page — documented in DEPLOYMENT.md. Request the
  **minimum** scope (`User.Read` is usually enough; avoid `.ReadWrite`,
  avoid `Directory.*`).

## 2. Quick Pulse response protection

Threat: a normal user reading or enumerating other people's ratings/comments.

Controls (defence in depth):

1. **List permissions** — `TH_QuickPulseResponses` has broken inheritance:
   members get *add* + *read-own-items-only*; a `TravelHub Pulse Admins` group
   gets read/manage. This is the real control.
2. **Service shape** — `QuickPulseService` for a normal user exposes only
   `userHasResponded: boolean` and (if the business permits) an
   `IQuickPulseAggregate` computed **server-side-style** by the service reading
   only counts. It never returns response rows to the UI.
3. **UI** — `QuickPulseCard` has no code path that renders a list of responses.
   "View Previous Results" shows aggregates only and is hidden entirely when the
   user is not a Pulse Admin *and* aggregates are disabled by config.
4. **Duplicate submission** — when `oneResponsePerUser` is set, the service
   checks for an existing row by `RespondentUpn` before insert and the button
   disables after success. (Client check is UX; the admin report de-dupes.)

Aggregates note: because a normal user cannot read the raw list, "aggregate for
everyone" requires either (a) a Pulse Admin-run rollup written to a readable
`TH_QuickPulseSummary` list/row, or (b) accepting that only admins see results.
Default: **option (b)**; option (a) is an ENHANCEMENT-GUIDE recipe. Recorded as
an open question.

## 3. Department spend protection

Threat: exposure of restricted financial data through the page.

Controls:

1. **Authorisation at the source** — access is enforced by the data layer that
   owns the numbers (restricted SharePoint list with broken inheritance, or
   Power BI RLS, or the Concur/API's own auth). The SPFx UI is **never** the
   security boundary.
2. `ITravelSpendService.getAccess()` returns `ITravelSpendAccess`; the card
   calls `getSpend()` only when `hasAccess` is true, and even then a source-side
   denial is caught and rendered as `ErrorState variant="forbidden"`.
3. Denied users see the mock's friendly panel + a link to request access — no
   figures, no partial data, no field names.
4. No spend numbers are cached in `localStorage`/`sessionStorage`. In-memory
   cache only, cleared on navigation.

## 4. Untrusted content handling

Editors populate list fields. Treat all of it as untrusted.

### URLs
- Central util `isSafeUrl(url)` — allow-list: `https:`, `http:`, `mailto:`,
  `tel:`, and site-relative paths starting `/`. Everything else (`javascript:`,
  `data:`, `vbscript:`, `file:`, unknown schemes) → rejected → `undefined`.
- Services validate every `*Url` during mapping. Components render a link only
  when the URL survived validation; otherwise the affordance is hidden or shown
  as inert text.
- `ExternalLink` re-checks at render time (belt and braces) and always sets
  `rel="noopener noreferrer"` when `target="_blank"`.
- Contact links: `TravelTeamCard` builds `mailto:`/`tel:` from the raw value
  after stripping CR/LF and validating the local part / digits — it never takes
  a full URL from the field.

### Text / rich text
- Default rendering is **plain text** (`{value}` in JSX, which React escapes).
- `dangerouslySetInnerHTML` is confined to one audited helper
  (`common/utils/sanitize.ts`) and used only if a field is explicitly designated
  rich text. That helper runs an allow-list sanitiser (tags: `p, br, ul, ol, li,
  strong, em, a, h3, h4`; attrs: `href` on `a` via `isSafeUrl`; strips
  `on*`, `style`, `script`, `iframe`). If in doubt, keep the field plain.
- User-entered strings that flow into `mailto:` subjects, query strings, or
  `aria-label` are encoded (`encodeURIComponent`).

### Images
- `imageUrl` values validated as URLs. `ImageWithFallback` sets `referrerpolicy`
  and an `onError` fallback. `iconBackgroundColor` is validated against a
  `#rgb/#rrggbb` / known-token pattern before being placed in a `style`.
- **Hero "image" quick link:** a `kind: 'image'` quick link (e.g. the Travel Care
  QR poster) opens in the in-app `ImageLightbox`, never by navigating the browser
  to the file URL. This keeps the document-library folder path out of the address
  bar so casual users are not dropped into the library. It is a UX/tidiness
  measure — the real control is SharePoint permissions on **Travel Hub Images**;
  keep only publicly-shareable assets there.

## 5. Data-in-transit / storage

- All calls are HTTPS to the tenant (PnPjs via `SPFx` context). No third-party
  endpoints introduced.
- No PII in `localStorage`. Per-viewer UI conveniences only (e.g. "which tip
  category was expanded") may use `sessionStorage`, wrapped in try/catch.
- No secrets, tokens, connection strings, or internal hostnames in source,
  config files, or the bundle. The on-prem article URLs live in list data, not
  code.

## 6. Logging

- `Logger` wraps `@microsoft/sp-core-library` `Log`. Log **errors and warnings**
  with correlation context (list, operation), never response bodies, never PII,
  never tokens.
- No `console.log` in shipped code (lint `no-console` in the hardening pass).

## 7. Dependency / supply chain

- `npm audit` must be clean at scaffold (SPFx 1.22 guarantee) and re-checked
  before each release. New dependencies require justification (ARCHITECTURE.md
  §9) and a licence check.
- Pin versions (the project already uses `overrides`/`resolutions`). No `^`
  ranges on new runtime deps without reason.

## 8. Anti-patterns (fail review)

- Relying on `config.sections.x.isVisible` or CSS `display:none` to "hide"
  sensitive data — visibility ≠ authorisation.
- Returning raw `TH_QuickPulseResponses` / `TH_DepartmentTravelSpend` rows to the
  browser for non-authorised users.
- `href={item.url}` straight from list data without `isSafeUrl`.
- `dangerouslySetInnerHTML` outside the sanitiser helper.
- Requesting broad Graph scopes "to be safe".
- Any secret in `write-manifests.json`, `serve.json`, `.env`, or code.

## 9. Phase 12 verification checklist

- [ ] Every `*Url` field passes through `isSafeUrl` in its service.
- [ ] `grep` shows `dangerouslySetInnerHTML` only in `sanitize.ts`.
- [ ] Pulse list permissions broken + verified with a test non-admin account.
- [ ] Spend list/report permissions verified with a denied account → friendly panel.
- [ ] No `console.*`, no secrets, `npm audit` clean.
- [ ] Graph scopes requested = scopes used, all minimal.
- [ ] `rel="noopener noreferrer"` on every `target="_blank"`.
- [ ] Reduced-motion + keyboard paths don't bypass any gating.
- [ ] `localStorage`/`sessionStorage` contains no PII or spend/pulse data.
