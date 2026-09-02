# TravelHub – Deployment

## What this is

How to build, package and release TravelHub, provision its SharePoint schema, and
roll back. The build toolchain is **Heft** (SPFx 1.22) — there is no `gulp`.

## 1. Prerequisites (per environment)

- SharePoint Online tenant + an **App Catalog** (tenant or site-collection).
- A modern SharePoint **site** to host the page (Communication site recommended).
- Permissions: SharePoint Administrator (or App Catalog owner) for the `.sppkg`;
  Site Owner for provisioning lists; Global/SharePoint admin to approve any Graph
  scope in **API access**.
- Local build box: Node v22, per [ENVIRONMENT.md](./ENVIRONMENT.md).

## 2. Build & package

```powershell
nvm use 22.23.1
npm install                 # first time / after dependency changes
npm run build               # heft test --clean --production && heft package-solution --production
```

Outputs:
- `sharepoint/solution/travel-hub.sppkg` — upload this.
- `release/` — assets + manifests + audit logs (CI artifacts).
- `temp/`, `lib/`, `dist/` — intermediates (git-ignored).

Local dev loop:
```powershell
npx heft trust-dev-cert     # one-time per machine
npm start                   # heft start --clean → https://localhost:4321
# open  https://<tenant>.sharepoint.com/_layouts/workbench.aspx
```
Set `SPFX_SERVE_TENANT_DOMAIN` so `{tenantDomain}` in `serve.json` resolves.

## 3. CDN / hosting

`config/package-solution.json` has `includeClientSideAssets: true` → assets ship
**inside** the package and are served from the tenant's built-in Office 365 CDN /
`ClientSideAssets`. No Azure Storage / external CDN required.
`config/write-manifests.json` `cdnBasePath` stays as the placeholder unless the
business mandates an external CDN (then document the change here).

## 4. Release steps

1. **Version bump** (deliberate, for real releases):
   - `package.json` `version`
   - `config/package-solution.json` `solution.version` (the `x.x.x.x` that the
     App Catalog compares) and the feature `version`.
2. `npm run build`.
3. Upload `travel-hub.sppkg` to the App Catalog → **Deploy**. Because
   `skipFeatureDeployment: true`, it is available tenant-wide without per-site
   activation.
4. If Graph scopes were added: SharePoint admin centre → **Advanced → API
   access** → approve the pending `webApiPermissionRequests` (documented per
   phase; Phase 1 requests **none**).
5. **Provision schema** into the target site (section 6).
6. **Create the page full-width** (section 6a), then add the **TravelHub** web
   part to it.
7. Populate / verify `TH_SiteConfiguration` and content lists.
8. Smoke test (section 7).

## 6a. Full-width page (edge-to-edge, no left nav)

The design is meant to fill the page edge-to-edge, with **no** SharePoint suite
bar, command bar, or side gutters visible. Most of this is a **page/site setup**;
the remainder (hiding the suite/command bar and the canvas's own padding) is
done by the web part itself when `layout.fullBleed` is on:

1. **Use a Communication site** (or a page with site navigation disabled).
   Communication sites have **no left navigation** by default. On a Team site the
   left nav cannot be hidden per-page — either switch to a Communication site or
   set the site to hide navigation.
2. **Add a Full-width section.** Edit the page → **+** between sections → section
   layout → **Full-width column**. (This layout only appears on Communication
   sites / pages without left nav.) It removes the canvas max-width and side
   padding.
3. **Put the TravelHub web part in that full-width section** (only one web part
   per full-width section).
4. Keep the page **header** minimal if wanted (Edit → page header → **Plain** or
   change layout), so the hero is the first thing under the suite bar.
5. Leave `layout.fullBleed = true` in `TH_SiteConfiguration` (the default). It
   makes the web part fill its section and removes the inner content max-width,
   so nothing is centred in a narrow column. On a live modern page it also
   injects a global stylesheet (`chromeOverride.ts`) that:
   - Hides `#spCommandBar`, `#sp-appBar`/`#spAppBar`, and the hashed modern
     site-header row (`.headerRow-113` / `[class*="headerRow-"]`).
   - Neutralizes the modern canvas's own wrappers around the web part —
     `#spPageChromeAppDiv`, `#spPageCanvasContent`, `.CanvasZone`,
     `.CanvasSection`, `.CanvasZoneSectionContainer`, `.ControlZone` — so
     their margin/padding/rounding/shadow/max-width don't leave a gutter
     around the section. This is the same `.CanvasZone`/`.ControlZone`
     technique the sibling HR-Hub-SPFx solution uses in its own
     `src/styles/host-reset.css`.

   Both are `:has()`-scoped to only the zones that actually contain
   TravelHub's root element (a `data-th-shell` marker), not every zone on the
   page, so a page mixing TravelHub with other web parts leaves their zones
   alone. This is a real DOM/CSS override outside the web part's own
   placeholder, so:
   - It hides the suite/command bar for **every visitor** of that page, not just
     while editing — only enable it on pages meant to be a fully immersive,
     chrome-free landing page.
   - `:has()` needs an evergreen browser (Baseline 2023); SharePoint Online's
     modern experience already requires one, so no fallback is provided.
   - The hashed `headerRow-*` class is not a stable public SharePoint selector;
     it can change with a SharePoint service update. If the header row
     reappears, re-inspect the page in devtools and update the selector in
     `chromeOverride.ts`.
   - It is a no-op in the local workbench (those elements don't exist there).
   - Set `layout.fullBleed` to `false` to keep the site chrome and sit the web
     part inside a normal centred section instead.

The web part is responsive at every width (mobile / tablet / desktop / wide) and
never scrolls horizontally. If you still see side gutters, the page is not using
a full-width section (step 2) or the site has a left nav (step 1).

## 5. Environments

| Env | App Catalog | Site | Notes |
| --- | --- | --- | --- |
| Dev | site-collection App Catalog on the dev site | `/sites/travelhub-dev` | fast iteration, `heft start` against the hosted workbench |
| Test / UAT | tenant App Catalog (or SC catalog) | `/sites/travelhub-uat` | business validation, full provisioning run |
| Prod | tenant App Catalog | `/sites/travelhub` | change-controlled release |

Keep the **same provisioning template** across all three so schema cannot drift.

## 6. SharePoint provisioning

Schema is **not** created by the `.sppkg`. Use one of:

### Option A — PnP Provisioning template (recommended)
- Template file: `provisioning/travelhub-template.xml` (authored in Phase 2 from
  [SHAREPOINT-SCHEMA.md](./SHAREPOINT-SCHEMA.md)).
- Apply with PnP PowerShell:
  ```powershell
  Connect-PnPOnline -Url https://<tenant>.sharepoint.com/sites/travelhub -Interactive
  Invoke-PnPSiteTemplate -Path .\provisioning\travelhub-template.xml
  ```
- Or CLI for Microsoft 365 (`m365 spo ...`).
- The template creates: the 15 `TH_*` lists, the 3 libraries, indexed columns,
  broken-inheritance permission setup for `TH_QuickPulseResponses` and
  `TH_DepartmentTravelSpend`, the SharePoint groups
  (`TravelHub Pulse Admins`, `TravelHub Spend Viewers`), and seed
  `TH_SiteConfiguration` rows with the documented defaults.

### Option B — Manual
Follow the tables in SHAREPOINT-SCHEMA.md. Only for throwaway dev sites.

### Post-provisioning
- Populate the Images/Documents/Videos libraries.
- Add editors to the appropriate SharePoint groups.
- Add members to `TravelHub Pulse Admins` / `TravelHub Spend Viewers` as agreed
  with the business.

## 7. Smoke test (every environment, every release)

- [ ] Page loads; all visible sections render (no blank areas).
- [ ] Hero rotates; quick links resolve; video (if any) is muted.
- [ ] Services carousel shows the configured card count per breakpoint.
- [ ] News featured + list; Events dates localised; Tips list.
- [ ] Quick Pulse: submit once → confirmation; reload → "already responded".
- [ ] Non-admin cannot see other pulse responses (test account).
- [ ] Testimonials carousel auto-scrolls + manual nav + keyboard.
- [ ] Spend card: denied account → friendly panel; permitted account → summary.
- [ ] Green Travel image + overlay; poster link opens.
- [ ] Team shows landing count; "View All" navigates.
- [ ] Footer columns/links from list; external links `noopener`.
- [ ] Mobile: no horizontal scroll; carousels swipe; tap targets ok.
- [ ] Keyboard-only pass of every carousel and the pulse form.
- [ ] `TH_SiteConfiguration` change (e.g. `services.desktopVisibleCards`) takes
      effect after reload.

## 8. Rollback

- **Package:** in the App Catalog, keep the previous `.sppkg`. To roll back,
  re-upload/redeploy the prior version (App Catalog retains version history; or
  store previous artifacts in the release pipeline).
- **Schema:** provisioning is largely additive. A bad template change is rolled
  back by re-applying the previous template version (source-controlled in
  `provisioning/`). Destructive column changes require a documented data plan —
  avoid.
- **Config:** `TH_SiteConfiguration` rows are content; revert the row or set
  `IsActive = No` to fall back to code defaults. No redeploy needed.
- **Page:** remove/re-add the web part or restore the page version.

## 9. CI/CD (recommended, not required for Phase 1)

Pipeline: `nvm use 22` → `npm ci` → `npm run build` → publish
`sharepoint/solution/*.sppkg` + `release/**` as artifacts → (gated) `m365 spo app
add --overwrite --publish` to the target catalog. Provisioning template applied
as a separate gated stage. `npm audit` and the Heft lint/jest phases are the
quality gates (they run inside `npm run build`).

## 10. Do not

- Do not hand-edit files under `lib/`, `dist/`, `release/`, `sharepoint/`.
- Do not commit `.sppkg` or build output (`.gitignore` already excludes them).
- Do not bump SPFx/React/TS/Node/Heft as part of a feature release.
- Do not put secrets in `serve.json` / `write-manifests.json` / env files.
- Do not rely on section-visibility config as an access control.
