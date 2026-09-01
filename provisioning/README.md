# TravelHub – Provisioning

| File | Purpose |
| --- | --- |
| `travelhub-provision.js` | create the lists, libraries, fields and lookups; seed `TH_SiteConfiguration` |
| `travelhub-sample-data.js` | fill the `TH_*` content lists with demo data matching the mockup |
| [SAMPLE-DATA.md](./SAMPLE-DATA.md) | what every column is for and what to put in it |
| `travelhub-template.xml` | (future) PnP site template for multi-environment parity |

Run `travelhub-provision.js` **first**, then `travelhub-sample-data.js`. Both are
idempotent (safe to re-run).

## Option A – Browser console (no PowerShell)

`travelhub-provision.js` creates every list, library, field (with choice
options), the lookup columns, and the default `TH_SiteConfiguration` rows using
only the SharePoint REST API.

### Steps

1. Sign in to the **target site** in your browser, e.g.
   `https://<tenant>.sharepoint.com/sites/travelhub`.
   You need **Site Owner** / *Manage Lists* rights on that site.
2. Open **DevTools → Console** (`F12`).
3. **Check the site URL.** The script auto-detects it from the page. If you are
   not on a normal page of the target site, set it explicitly near the top:
   `TARGET_WEB_URL: "https://<tenant>.sharepoint.com/sites/travelhub",`
4. Open `travelhub-provision.js`, copy the **whole file**, paste it into the
   console, press **Enter**.
5. Read the console output. Lines are `+` (created), `=` (already existed),
   `!` (issue). A tallied **SUMMARY** prints at the end with an **ISSUES** list
   if anything actually failed.

### "I see a wall of red errors"

A clean run produces almost none. Existence checks use `$filter` queries that
return HTTP 200, so red `404`/`400` lines mean something real — usually a wrong
`TARGET_WEB_URL` or missing permissions. The `[TravelHub]` `log` lines and the
SUMMARY are the source of truth, not the browser's network error logging.
If you see `FATAL`, nothing after it ran — fix the cause and re-run.

### Before running – optional edits (top of the file, `CONFIG` block)

| Setting | Default | Purpose |
| --- | --- | --- |
| `TARGET_WEB_URL` | current site | provision a different site |
| `CREATE_LIBRARIES` | `true` | also create the 3 asset libraries |
| `SEED_CONFIG` | `true` | add the ~60 default `TH_SiteConfiguration` rows |
| `DRY_RUN` | `false` | log actions without writing anything |
| `THROTTLE_MS` | `150` | delay between write calls; raise if you hit throttling |

### What it does NOT do

- It does **not** break permission inheritance or create the
  `TravelHub Pulse Admins` / `TravelHub Spend Viewers` groups. Those are
  tenant-specific and are done by hand — a commented `breakInheritanceExample()`
  helper is at the bottom of the script. See [../docs/SECURITY.md](../docs/SECURITY.md).
- It does not upload images or content — only the empty structure.

### After running

1. Upload imagery to **Travel Hub Images**; copy each file's URL into the
   relevant `*Url` column.
2. Populate the `TH_*` content lists (see
   [../docs/SHAREPOINT-SCHEMA.md](../docs/SHAREPOINT-SCHEMA.md)).
3. Restrict `TH_QuickPulseResponses` and `TH_DepartmentTravelSpend`.
4. Add the **TravelHub** web part to a page.

> With no content, every section renders its empty/fallback state by design —
> the page will not error.

## Option B – PnP site template (for repeatable dev/UAT/prod)

`travelhub-template.xml` (to be authored) applied with PnP PowerShell or
CLI for Microsoft 365. See [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) §6.
Use this once you have more than one environment to keep schemas identical.
