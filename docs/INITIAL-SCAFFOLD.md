# TravelHub – Initial Scaffold Reference

_Last verified: 2026-09-01 · Git: commit `9124550` "Initial SPFx Travel Hub scaffold", working tree clean_

This is the untouched output of `yo @microsoft/sharepoint` (generator 1.22.2)
plus one verified build. No TravelHub functionality has been implemented yet.
The sections below describe **what is actually in the repo**.

---

## 1. `package.json`

- **name:** `travel-hub` · **version:** `0.0.1` · `private: true`
- **engines.node:** `>=22.14.0 < 23.0.0`

### Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `build` | `heft test --clean --production && heft package-solution --production` | Full production build: clean → compile → sass → lint → jest → bundle → package `.sppkg` |
| `start` | `heft start --clean` | Local dev server + hosted workbench, watch mode |
| `clean` | `heft clean` | Delete build output folders |
| `eject-webpack` | `heft eject-webpack` | Emit the effective webpack config for customization (advanced, not done) |

> There is no separate `lint` or `test` script. Linting and Jest run as **phases
> inside `heft test`** (which itself runs the build first).

### Dependencies (runtime)

| Package | Version |
| --- | --- |
| `react` | `17.0.1` |
| `react-dom` | `17.0.1` |
| `tslib` | `2.3.1` |
| `@fluentui/react` | `^8.106.4` |
| `@microsoft/sp-core-library` | `1.22.2` |
| `@microsoft/sp-component-base` | `1.22.2` |
| `@microsoft/sp-property-pane` | `1.22.2` |
| `@microsoft/sp-webpart-base` | `1.22.2` |
| `@microsoft/sp-lodash-subset` | `1.22.2` |
| `@microsoft/sp-office-ui-fabric-core` | `1.22.2` |

### devDependencies

| Package | Version | Role |
| --- | --- | --- |
| `@rushstack/heft` | `1.1.2` | Build orchestrator (also pinned in `overrides`) |
| `@microsoft/spfx-web-build-rig` | `1.22.2` | Rig: holds the real tsconfig / sass / webpack config |
| `@microsoft/spfx-heft-plugins` | `1.22.2` | SPFx-specific Heft phases (bundle, package-solution, serve) |
| `typescript` | `~5.8.0` | Compiler |
| `@types/react` | `17.0.45` | (also pinned in `resolutions`) |
| `@types/react-dom` | `17.0.17` | |
| `eslint` | `8.57.1` | Classic (non-flat) ESLint |
| `@rushstack/eslint-config` | `4.5.2` | |
| `@microsoft/eslint-config-spfx` | `1.22.2` | |
| `@microsoft/eslint-plugin-spfx` | `1.22.2` | |
| `@typescript-eslint/parser` | `8.46.2` | |
| `eslint-plugin-react-hooks` | `4.3.0` | |
| `css-loader` | `~7.1.2` | |
| `@types/heft-jest` | `1.0.2` | |
| `@types/webpack-env` | `~1.15.2` | |
| `@microsoft/sp-module-interfaces` | `1.22.2` | |

### `overrides` / `resolutions`

- `overrides["@rushstack/heft"] = "1.1.2"` — forces a single Heft version tree-wide.
- `resolutions["@types/react"] = "17.0.45"` — prevents a newer React 18 typings
  from leaking in transitively (a known SPFx runtime hazard).

---

## 2. SPFx configuration

### `.yo-rc.json`

```json
{
  "@microsoft/generator-sharepoint": {
    "useGulp": false,
    "isCreatingSolution": true,
    "nodeVersion": "22.23.1",
    "version": "1.22.2",
    "libraryName": "travel-hub",
    "libraryId": "dc8ca96a-e980-4257-a7a5-27f85c069a27",
    "environment": "spo",
    "packageManager": "npm",
    "solutionName": "TravelHub",
    "skipFeatureDeployment": true,
    "isDomainIsolated": false,
    "componentType": "webpart"
  }
}
```

### `config/config.json` (schema `config.2.0`)

- **Bundle:** `travel-hub-web-part`
  - entrypoint: `./lib/webparts/travelHub/TravelHubWebPart.js`
  - manifest: `./src/webparts/travelHub/TravelHubWebPart.manifest.json`
- **externals:** none
- **localizedResources:** `TravelHubWebPartStrings` → `lib/webparts/travelHub/loc/{locale}.js`

### `config/package-solution.json`

| Field | Value |
| --- | --- |
| solution.name | `travel-hub-client-side-solution` |
| solution.id | `dc8ca96a-e980-4257-a7a5-27f85c069a27` |
| version | `1.0.0.0` |
| includeClientSideAssets | `true` |
| skipFeatureDeployment | `true` |
| isDomainIsolated | `false` |
| feature id | `25be6cf2-631b-4e3d-9047-63fe070dff7f` |
| zippedPackage | `solution/travel-hub.sppkg` |

### Other `config/` files (all default, rig-extended)

| File | Content |
| --- | --- |
| `rig.json` | `rigPackageName: "@microsoft/spfx-web-build-rig"` |
| `typescript.json` | extends rig default; copies `.resx/.jpg/.png/.woff/.eot/.ttf/.svg/.gif` and `webparts/*/loc/*.js` |
| `sass.json` | extends rig default (Heft sass plugin) |
| `serve.json` | port `4321`, https, `initialPage: https://{tenantDomain}/_layouts/workbench.aspx` |
| `write-manifests.json` | `cdnBasePath` placeholder (unset) |
| `deploy-azure-storage.json` | placeholder Azure Storage settings (unused) |

---

## 3. Web part entry point

[`src/webparts/travelHub/TravelHubWebPart.ts`](../src/webparts/travelHub/TravelHubWebPart.ts)

- `export default class TravelHubWebPart extends BaseClientSideWebPart<ITravelHubWebPartProps>`
- Props interface: `ITravelHubWebPartProps { description: string }`
- `render()` creates the `TravelHub` React element via `React.createElement` and
  mounts it with `ReactDom.render(element, this.domElement)`.
- `onInit()` resolves an environment message (SharePoint / Teams / Office / Outlook).
- `onThemeChanged()` maps theme semantic colors to CSS custom properties
  (`--bodyText`, `--link`, `--linkHovered`).
- `onDispose()` calls `ReactDom.unmountComponentAtNode`.
- Property pane: a single `PropertyPaneTextField('description')`.
- `dataVersion` = `1.0`.

### Manifest — `TravelHubWebPart.manifest.json`

| Field | Value |
| --- | --- |
| id | `749f248e-9733-4d32-b617-9bd7043e63ce` |
| alias | `TravelHubWebPart` |
| componentType | `WebPart` |
| manifestVersion | `2` |
| version | `*` (taken from `package.json`) |
| requiresCustomScript | `false` |
| supportedHosts | `SharePointWebPart`, `TeamsPersonalApp`, `TeamsTab`, `SharePointFullPage` |
| supportsThemeVariants | `true` |
| preconfigured group | `Advanced` · title `TravelHub` · default `description: "TravelHub"` |

---

## 4. React component

[`src/webparts/travelHub/components/TravelHub.tsx`](../src/webparts/travelHub/components/TravelHub.tsx)

- `export default class TravelHub extends React.Component<ITravelHubProps>` —
  **class component** (not a function component / no hooks).
- Renders the default SPFx "Well done" welcome card: theme-aware `welcome-*.png`,
  the current user's display name, the environment message, the `description`
  property value, and a list of SPFx documentation links.
- User-supplied strings are passed through `escape()` from `sp-lodash-subset`.

Props — [`components/ITravelHubProps.ts`](../src/webparts/travelHub/components/ITravelHubProps.ts):

```ts
interface ITravelHubProps {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
}
```

Styles — `components/TravelHub.module.scss`: imports Fluent UI `References.scss`,
defines `.travelHub`, `.welcome`, `.welcomeImage`, `.links`, with theme tokens
(`[theme:bodyText]`, `[theme:link]`, `[theme:linkHovered]`).

Localization:
- `loc/mystrings.d.ts` — `ITravelHubWebPartStrings` interface + `declare module 'TravelHubWebPartStrings'`.
- `loc/en-us.js` — AMD `define([], …)` returning the string values.

Assets: `assets/welcome-light.png`, `assets/welcome-dark.png`.

---

## 5. TypeScript configuration

[`tsconfig.json`](../tsconfig.json) is a single line:

```json
{ "extends": "./node_modules/@microsoft/spfx-web-build-rig/profiles/default/tsconfig-base.json" }
```

Effective compiler options (from the rig base):

| Option | Value |
| --- | --- |
| `target` | `es5` |
| `module` | `esnext` |
| `moduleResolution` | `node` |
| `jsx` | `react` |
| `strict` | `true` (incl. `noImplicitAny`) |
| `declaration` / `declarationMap` / `sourceMap` | `true` |
| `experimentalDecorators` | `true` |
| `esModuleInterop` | `true` |
| `importHelpers` | `true` (uses `tslib`) |
| `skipLibCheck` | `true` |
| `types` | `["heft-jest", "webpack-env"]` |
| `outDir` | `lib/` · `rootDir` | `src/` |
| `lib` | `dom`, `es5`, `es2015.core/collection/iterable/promise/proxy` |

VS Code is pinned to the workspace TypeScript: `.vscode/settings.json` →
`"typescript.tsdk": ".\\node_modules\\typescript\\lib"`.

---

## 6. Build configuration

- **Orchestrator:** Heft `1.1.2` (local). **No `gulpfile.js`.**
- **Rig:** `@microsoft/spfx-web-build-rig@1.22.2` (`config/rig.json`) supplies the
  tsconfig / sass / webpack defaults.
- **SPFx Heft plugins:** `@microsoft/spfx-heft-plugins@1.22.2` provide the
  `bundle`, `package-solution`, `serve` and `trust-dev-cert` actions.
- **Bundler:** webpack (unchanged from Gulp era), config owned by the rig; can be
  surfaced with `heft eject-webpack` (not done).
- **ESLint:** `.eslintrc.js` (classic config) extends
  `@microsoft/eslint-config-spfx/lib/profiles/react`; runs as a Heft phase.
- **Jest:** wired via `@types/heft-jest`; runs in `heft test`. No test files exist yet.

### Verified build artifacts present in the working tree

```
lib/                                  compiled ESM + .d.ts
lib-commonjs/                          compiled CJS
dist/                                  webpack bundles
release/manifests/…                    component manifest(s)
release/assets/…                       hashed JS + png assets
release/analysis-logs/lint.sarif       lint results
release/component-dependency-audit/…   dependency audit
sharepoint/solution/travel-hub.sppkg   packaged solution
sharepoint/solution/debug/…            unzipped package contents
```

The initial `npm run build` therefore completed successfully through packaging.

---

## 7. `.gitignore`

Heft-era ignore list (superset of the old Gulp one). Ignored:

```
logs, *.log, npm-debug.log*
node_modules
dist, lib, lib-dts, lib-commonjs, lib-esm, jest-output, release, solution, temp
*.sppkg, .heft
coverage
.DS_Store, .ntvs_analysis.dat, .vs, bin, obj
*.resx.ts, *.scss.ts
```

Consequences:
- The built `.sppkg` and all `lib*/`, `dist/`, `release/`, `temp/` output are
  **not** committed — expected.
- Generated `*.scss.ts` typings are ignored.
- `.npmignore` does the inverse for npm publish (ignore all, then un-ignore
  `bin/`, `dist/`, `lib/`, `EULA/`, `ThirdPartyNotice.txt`).

---

## 8. Existing dependencies — summary

- **Framework:** SPFx `1.22.2` (`@microsoft/sp-*`), React `17.0.1`.
- **UI kit:** Fluent UI React `^8.106.4` (v8 — the SPFx-compatible line).
- **Build:** Heft `1.1.2` + `spfx-web-build-rig` `1.22.2` + `spfx-heft-plugins` `1.22.2`.
- **Language/lint:** TypeScript `~5.8.0`, ESLint `8.57.1` + SPFx/rushstack configs.
- **No** data-access, routing, state-management, PnPjs, MSGraph, or test libraries
  have been added. Nothing beyond the generator defaults.

### VS Code helpers (scaffold defaults)

- `.vscode/launch.json` — "Hosted workbench" debug config (Edge,
  `--remote-debugging-port=9222`, `-incognito`, source-map overrides).
- `.vscode/settings.json` — file-explorer excludes + workspace TS SDK pin.

### Teams / Viva assets

`teams/749f248e-…_color.png` and `…_outline.png` — app icons emitted because the
manifest lists Teams hosts.
