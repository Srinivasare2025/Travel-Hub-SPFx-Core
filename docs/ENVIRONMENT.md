# TravelHub – Development Environment

_Last verified: 2026-09-01_

This document records the **actual** toolchain the TravelHub SPFx solution was
scaffolded and first built with. Do not change any of these versions without a
deliberate, separately-planned upgrade.

## Workstation toolchain

| Tool | Version detected | Notes |
| --- | --- | --- |
| OS | Windows 11 Home (10.0.26200) | |
| Node.js | **v22.23.1** (active) | Node 22 LTS ("Jod"). Managed by `nvm` for Windows (`C:\nvm4w`). |
| npm | 10.9.8 | Bundled with Node 22. |
| Yeoman (`yo`) | 4.3.0 | Installed in `C:\Users\srini\AppData\Roaming\npm`. |
| `@microsoft/generator-sharepoint` | 1.22.2 | Global generator used to scaffold this project. |
| Git | 2.49.0.windows.1 | |
| `@rushstack/heft` (global) | not installed globally | Project uses its **local** Heft `1.1.2`. A global install is optional convenience only. |

### Multiple Node.js installations

`nvm4w` manages five Node versions: **22.23.1** (active), 22.22.2, 20.13.1,
18.18.2, 16.13.0. There is no automatic version switching. Before working on
TravelHub, confirm the active version:

```powershell
nvm list
nvm use 22.23.1
node -v   # must report v22.x
```

Node 16 / 18 / 20 are **not** supported by SPFx 1.22 and will break the build.

### Global-package layout caveat

`npm config get prefix` points at `C:\nvm4w\nodejs`, but the global CLI tools
(`yo`, `@microsoft/generator-sharepoint`, a legacy `gulp-cli`, `typescript`,
`@angular/cli`) actually live in `C:\Users\srini\AppData\Roaming\npm`, which is
on `PATH`. `npm ls -g` will not list them. This does not affect TravelHub
builds — the project resolves Heft, TypeScript, React, ESLint and every build
plugin from its **local** `node_modules`.

## Project runtime requirements

Declared in [`package.json`](../package.json):

```json
"engines": { "node": ">=22.14.0 < 23.0.0" }
```

| Requirement | Value | Source |
| --- | --- | --- |
| SPFx version | **1.22.2** | `.yo-rc.json`, all `@microsoft/sp-*` deps |
| Build toolchain | **Heft** (Rush Stack) — `useGulp: false` | `.yo-rc.json`, `config/rig.json` |
| Node.js | v22 LTS (`>=22.14.0 <23`) | `package.json` engines |
| TypeScript | `~5.8.0` | `package.json` devDependencies |
| React / react-dom | **17.0.1** (exact) | `package.json`; `@types/react` pinned to `17.0.45` via `resolutions` |
| Target tenant | SharePoint Online (`environment: "spo"`) | `.yo-rc.json` |
| Component type | client-side web part | `.yo-rc.json` |

## Heft toolchain overview

SPFx 1.22 replaced the legacy Gulp toolchain with **Heft**. Key differences
already visible in this project:

- **No `gulpfile.js`.** Build orchestration is Heft, driven by npm scripts.
- **`config/rig.json`** points build configuration at the rig package
  `@microsoft/spfx-web-build-rig`. Most compiler / sass / webpack config lives
  inside that package, not in this repo.
- **`tsconfig.json`** is a one-line `extends` of the rig's base config.
- Build output folders: `lib/` (ESM), `lib-commonjs/`, `dist/` (bundles),
  `release/` (assets + audit logs), `temp/` (Heft intermediates),
  `sharepoint/solution/` (the `.sppkg`). All are git-ignored.

## Environment setup steps (for a new machine / fresh clone)

```powershell
nvm install 22.23.1
nvm use 22.23.1
npm install -g @rushstack/heft      # optional convenience
git clone <repo>
cd Travel-hub-spfx-core
npm install
npx heft trust-dev-cert             # one-time, trusts the local dev SSL cert
```

> Do **not** run `npm update`, bump `@microsoft/sp-*`, React, TypeScript, or Heft
> as part of routine work. Those are locked to the SPFx 1.22.2 baseline.
