# TravelHub – Documentation Index

TravelHub is a SharePoint Online **landing-page portal** built with SPFx, React
and TypeScript. It surfaces travel services, news, events, tips, a pulse survey,
traveller testimonials, department spend, sustainability content, the travel team
and a configurable footer — all driven by SharePoint content so the business can
maintain it without developer involvement.

## What this documentation is

The `/docs` folder is a **first-class deliverable**, not notes. It is the contract
between the architecture and every future change. Read it before touching code.

| Document | What it covers |
| --- | --- |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Verified workstation toolchain and locked runtime versions (Phase 0) |
| [INITIAL-SCAFFOLD.md](./INITIAL-SCAFFOLD.md) | Exact state of the generator output + first build (Phase 0) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layering, folder structure, component hierarchy, data flow, DI |
| [COMPONENTS.md](./COMPONENTS.md) | Common component library + section components, props, responsibilities |
| [DATA-MODEL.md](./DATA-MODEL.md) | TypeScript interfaces, mapping rules, `any` policy |
| [SHAREPOINT-SCHEMA.md](./SHAREPOINT-SCHEMA.md) | Lists, libraries, columns, content types, provisioning |
| [SECURITY.md](./SECURITY.md) | Permission model, URL/HTML sanitisation, Quick Pulse & spend data protection |
| [PERFORMANCE.md](./PERFORMANCE.md) | Per-service API-call budget, caching, payload sizes, pagination, rendering |
| [CONFIGURATION.md](./CONFIGURATION.md) | `TH_SiteConfiguration` keys, precedence, how components consume config |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Build, package, App Catalog, provisioning, environments, rollback |
| [TEST-PLAN.md](./TEST-PLAN.md) | Unit / integration / accessibility / performance / UAT test matrix |
| [ASSUMPTIONS_AND_OPEN_QUESTIONS.md](./ASSUMPTIONS_AND_OPEN_QUESTIONS.md) | Every inference made from the mock + questions for the business |
| [ENHANCEMENT-GUIDE.md](./ENHANCEMENT-GUIDE.md) | Step-by-step recipes for common future changes |

## Locked baseline (do not change without a dedicated upgrade project)

SPFx **1.22.2** · Heft toolchain · React **17.0.1** · TypeScript **~5.8.0** ·
Node **v22**. See [ENVIRONMENT.md](./ENVIRONMENT.md).

## Delivery phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Environment + scaffold verification | ✅ done |
| 1 | Architecture + documentation | ✅ done |
| 2 | Project foundation: design tokens, typography, service base, DI wiring, models | ✅ done |
| 3 | Common component library | ✅ done (Modal + ImageLightbox added early for the hero image viewer; Rating lands with Phase 7) |
| 4 | Hero Banner | ✅ done |
| 5 | Travel Services carousel | ✅ done |
| 6 | Travel Updates (News / Events / Tips) | ✅ done |
| 7 | Quick Pulse + Testimonials | pending |
| 8 | Department Spend + Green Travel | pending |
| 9 | Meet the Travel Team | pending |
| 10 | Footer | pending |
| 11 | Integration (compose sections in `TravelHub.tsx`, config-driven visibility) | partial — hero/services/updates wired; remaining sections join here |
| 12 | Performance / security / accessibility hardening pass | pending |
| 13 | Final testing + deployment docs | pending |

**Dependency added in Phase 2:** `@pnp/sp` / `@pnp/core` / `@pnp/queryable` `4.21.0`
(exact-pinned). No other runtime dependency added.

**Test tooling:** `config/jest.config.json` extends the rig config and maps
`@microsoft/sp-core-library` to a Jest stub (`src/common/testing/spCoreLibraryMock.ts`)
because the real module pulls Microsoft-internal packages that don't resolve
under Jest. Component tests (React Testing Library) are still to be added with
Phase 7 hardening.

Each phase: plan → files list → code → explanation → data flow → SharePoint
dependency → security notes → performance notes → test cases. No unrelated files
are touched.

## Guiding principle

More code is not a better solution. Priority order: **architecture,
maintainability, performance, security, accessibility, configuration,
reusability, business usability, visual fidelity.** A second developer should
understand it quickly; the business/admin team should never need a developer for
normal content or configuration changes.
