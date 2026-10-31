# Feature-based code structure

**Status:** applied 31 October 2026 under accepted [ADR 0008](decisions/0008-feature-based-modules.md); rules enforced by the tooling test.

**Responsible role:** technical maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, branch `refactor/feature-structure` (stages 1–4).

**Sources:** [packages/backend/src/](../../packages/backend/src/), [packages/backend/package.json](../../packages/backend/package.json), [apps/web/features/](../../apps/web/features/), [apps/web/server/](../../apps/web/server/), [apps/web/app/](../../apps/web/app/), [tests/](../../tests/), [vitest.backend.config.ts](../../vitest.backend.config.ts), [tests/tooling/workspace.test.ts](../../tests/tooling/workspace.test.ts).

This page is the standard for **where code goes**. The rules for *how* code behaves (atomic saves, commit-time checks, retries, privacy) stay in [AGENTS.md](../../AGENTS.md), the [overview](overview.md) and the [database contract](database.md). The layout makes those rules easier to follow.

## The idea in one paragraph

Everything that belongs to one business area (rooms, bookings, payments, …) lives together in one feature folder: its services, reads, persistence, UI components, helpers and tests. Code goes to a shared root folder only when two or more features (or the app shell) use it. Build it inside the feature first; move it to shared when a second feature needs it. Other features reach a feature only through its public entry file.

## Tree

~~~text
packages/backend/
├── src/
│   ├── shared/                       # kernel; imports no feature
│   │   ├── errors.ts operations.ts access.ts schema.ts diagnostics.ts outbox.ts
│   │   ├── index.ts                  # public API (@root-of-cambodia/backend/shared)
│   │   └── tests/
│   ├── features/<feature>/
│   │   ├── index.ts                  # PUBLIC API (@root-of-cambodia/backend/<feature>)
│   │   ├── <name>.ts                 # service: validation, permissions, rules
│   │   ├── <name>-queries.ts         # scoped, bounded reads
│   │   ├── <name>-persistence.ts     # one named atomic save per operation; never exported
│   │   └── tests/*.test.ts           # native D1 tests for this feature
│   └── testing/                      # shared test fixtures and support (never exported)
├── tests/                            # cross-feature backend tests (migrations, safeguards, boundaries, booking core)
└── migrations/                       # one ordered SQL directory for the whole schema

apps/web/
├── app/                              # Next.js routes: thin pages, layouts, route handlers
├── features/<feature>/
│   ├── components/                   # the feature's components (forms, panels, displays)
│   ├── screens/                      # optional: full-page compositions extracted from a route
│   ├── hooks/  lib/  tests/          # optional, when the feature needs them
│   ├── index.ts                      # optional: client-safe building blocks other features use
│   └── server.ts                     # optional: server-only entry (media, publication today)
├── components/
│   ├── ui/                           # shadcn primitives (Button, Card, Input, …)
│   └── *.tsx                         # shared UI: PageContainer, PageTitle, TextLink, StatusMessage… (docs/design/ui-standard.md)
├── lib/                              # shared pure helpers: utils, booking-format, return-path
└── server/                           # shared server-only adapters: http, sessions, runtime, policy

apps/jobs/src/                        # scheduled/queue adapters calling backend feature APIs

tests/
├── integration/                      # built web/jobs Worker and staging runtime
├── e2e/                              # Playwright journeys (desktop + phone) and the test server
└── tooling/                          # workspace, state-handoff and feature-boundary checks
~~~

Create only the folders a feature needs. Today every web feature has `components/`; `media` and `publication` also have a `server.ts`. No feature needs an `index.ts` yet, because no web feature imports another.

## Rules

1. **Feature code lives in its feature folder.** Root `shared/`, `components/`, `lib/` and `server/` hold only code used by two or more features or by the app shell. Start inside the feature; promote to shared in the same PR that adds the second user. Example: `booking-format.ts` started in bookings and moved to `lib/` once five features used it.
2. **Public entries.**
   - Backend: `features/<feature>/index.ts` re-exports the feature's services, queries and types. `*-persistence.ts` is never exported; only the feature's own service and tests call it.
   - Web: `index.ts` is client-safe (building-block components, hooks, types). `server.ts` is server-only. Never mix them: re-exporting server code from a client-safe barrel pulls it into the browser bundle.
3. **Between features, import only the public entry:** `@root-of-cambodia/backend/bookings`, `@/features/catalog`, `@/features/media/server`. Deep imports into another feature and relative paths that leave a feature are refused.
4. **`index.ts` exports building blocks only:** navigation, pickers, display components, hooks, types. Never forms or screens. Building blocks do not import screens, so features cannot form cycles.
5. **Inside a feature, use relative imports** (`./room-queries`, `../components/room-type-form`). Anything outside the feature uses `@/` aliases (web) or the package entry (backend consumers).
6. **Routes in `apps/web/app/` stay thin.**
   - A `page.tsx` reads params, runs the session guard and authorized read (shared `@/server/*` or a feature's `server.ts`), and renders the feature's components. Routes are the only code allowed to import a feature's `components/` or `screens/` directly.
   - When a page grows beyond guard, read and render, move its markup unchanged into `features/<feature>/screens/<name>-screen.tsx`.
   - A `route.ts` handler parses transport (session, Origin, body cap) with `@/server/http` and calls the backend feature's public API. Business rules never live in routes.
7. **Backend features form a one-way graph** ([layers](#feature-layers)). A feature imports only lower layers; `shared` imports no feature.
8. **Shared web code imports no feature.** `components/`, `lib/` and `server/` must not depend on `features/`.
9. **Client components never import server-only code** (`@/server/*` or a feature's `server.ts`).
10. **Backend file names keep the convention** `<name>.ts`, `<name>-queries.ts`, `<name>-persistence.ts`. Web files are lowercase kebab-case; components export PascalCase names.
11. **Migrations stay in one ordered directory.** Schema ownership per feature is recorded in the [database contract](database.md).
12. **Tests sit with the code they test** (see [testing](../development/testing.md#select-meaningful-checks) for the full table). Shared fixtures live in `packages/backend/src/testing/`; root `tests/` is only for whole-app integration, e2e and tooling.

## Feature catalog

Web folders use the same names as backend folders.

| Feature | Backend files | Web | Routes / API | Docs contract |
| --- | --- | --- | --- | --- |
| `shared` | errors, operations, access, schema, diagnostics, outbox | `components/ui/` primitives, shared `components/` (see [UI standard](../design/ui-standard.md)), `lib/`, `server/` | — | [overview](overview.md), [database](database.md), [notifications](../features/notifications.md) |
| `accounts` | auth | account-form, auth-form | `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, `/api/auth` | [setup](../development/setup.md), [staging](../operations/staging.md) |
| `properties` | property-drafts, property-queries, property-persistence | property-form, property-navigation | `/owner`, `/owner/properties/[id]`, `/api/owner/properties` | [owner supply](../features/owner-supply.md) |
| `property-information` | property-information, -queries, -persistence | property-information-form | `…/information` | [owner supply](../features/owner-supply.md) |
| `property-logistics` | property-logistics, -queries, -persistence | property-logistics-form | `…/logistics` | [owner supply](../features/owner-supply.md) |
| `media` | media, media-queries, media-persistence | property-photos; `server.ts` (media-http, media-runtime) | `…/photos` | [ADR 0004](decisions/0004-private-media-lifecycle.md) |
| `rooms` | room-types, room-queries, room-persistence | room-type-form | `…/rooms` | [owner supply](../features/owner-supply.md) |
| `calendar` | calendar, calendar-dates, calendar-queries, calendar-persistence | room-calendar-form | `…/rooms/[roomId]/calendar` | [owner supply](../features/owner-supply.md) |
| `inventory` | inventory, inventory-persistence | inventory-night-form | `…/availability`, `/api/inventory` | [owner inventory](../product/owner-inventory-operations.md) |
| `quotes` | quotes, quote-queries | — | `/api/booking-quotes` | [bookings](../features/bookings.md) |
| `payments` | payments, payment-queries, payment-persistence | payment-records | `/api/owner/bookings/[id]/payments` | [payments](../features/payments.md) |
| `publication` | publication, publication-queries, publication-persistence, publication-readiness, public-listing | publication-action, publication-checklist, review-snapshot; `server.ts` (reviewer-read) | `/review`, `…/review`, `/api/property-reviews` | [publication review](../features/publication-review.md), [ADR 0005](decisions/0005-public-listing-boundary.md) |
| `catalog` | catalog-queries | public-stay-details, stay-photo | `/stays`, `/api/stays` | [guest browsing](../features/guest-browsing.md) |
| `listing-controls` | listing-controls, listing-control-queries, listing-control-persistence | listing-controls | `…/listing` | [ADR 0007](decisions/0007-owner-listing-controls.md) |
| `bookings` | bookings, booking-persistence, booking-logistics, guest-bookings, owner-bookings, stay-queries | booking-logistics, booking-review, guest-cancel, guest-request-form, owner-booking-response, owner-stay-action | `/bookings`, `/stays/[id]/request`, `…/bookings`, `/api/bookings`, `/api/guest`, `/api/owner/bookings` | [bookings](../features/bookings.md), [ADR 0006](decisions/0006-booking-journey.md) |
| `external-bookings` | external-bookings, external-booking-queries, external-booking-persistence | external-reservation-form, external-reservation-review | `…/bookings/external`, `/api/external-reservations` | [owner inventory](../product/owner-inventory-operations.md) |
| `jobs` | jobs | — (apps/jobs) | scheduled/queue | [notifications](../features/notifications.md) |

Placement notes:

- `public-listing` lives in `publication`: it computes the public-display digest that review approval binds to, and it shared a type-only import cycle with publication-queries.
- `outbox` lives in `shared`: it is the delivery primitive that diagnostics and jobs both use.
- `lib/return-path.ts` is a pure URL check used by the client auth form and the server sessions, so it is shared and client-safe rather than in `server/`.

## Feature layers

A backend feature may import features in **lower** layers only. The tooling test holds the same table.

| Layer | Features | Depends on |
| --- | --- | --- |
| 0 | `shared` | nothing |
| 1 | `accounts`, `properties`, `property-information`, `property-logistics`, `media`, `rooms`, `inventory`, `quotes`, `payments` | shared |
| 2 | `calendar`, `publication` | rooms; media |
| 3 | `catalog` | publication, media |
| 4 | `listing-controls`, `bookings` | catalog, publication; quotes, catalog, payments |
| 5 | `external-bookings`, `jobs` | bookings, quotes; bookings |

A dependency that points sideways or upward means the code is in the wrong feature, or the shared piece belongs in a lower layer. Fix the design; do not add a deep import. A new feature gets a row in this table and in `backendLayers` in the tooling test.

## Next.js versus the nuk-cafe (Nuxt) standard

| nuk-cafe (Nuxt/Vue) | This project (Next.js/React) |
| --- | --- |
| `app/pages/` thin route files | `apps/web/app/**/page.tsx` thin routes |
| `<Feature>ListPage.vue` | Route markup today; `features/<f>/screens/<name>-screen.tsx` when extracted |
| `composables/use<X>.ts` | `features/<f>/hooks/use-<x>.ts` |
| `schemas/<feature>-form.ts` (Valibot) | Request validation lives in backend services; a web-side form schema would go in `features/<f>/lib/` |
| Auto-imported root code | No auto-imports: `@/components`, `@/lib`, `@/server` |
| `server/` Nitro API | `app/api/**/route.ts` thin handlers + `packages/backend` features |
| `shared/contracts/` | Backend feature `index.ts` types, one library used by web and jobs |
| Query keys / `invalidate()` | Not used: pages are server-rendered reads; client components call `router.refresh()` after a write |
| ESLint boundary rules | Regex checks in [tests/tooling/workspace.test.ts](../../tests/tooling/workspace.test.ts) |

## Adding a new feature

1. Confirm the behavior is accepted ([decision proposal](../playbooks/decision-proposal.md), [feature slice](../playbooks/feature-slice.md)).
2. Choose the resource name and its layer; add it to the layer table here and to `backendLayers` in the tooling test.
3. Backend: create `packages/backend/src/features/<name>/` with `index.ts`, the service/queries/persistence files and `tests/`. Add `"./<name>": "./src/features/<name>/index.ts"` to `packages/backend/package.json` `exports`.
4. Web: create `apps/web/features/<name>/components/` (and other folders only as needed). Routes in `app/` import from it.
5. Add the catalog row above, update the [module map](overview.md#module-map) and the feature contract in `docs/features/`.

## Enforcement

[tests/tooling/workspace.test.ts](../../tests/tooling/workspace.test.ts) checks every import in `packages/backend/src`, `apps/web/{app,features,components,lib,server}`, `apps/jobs/src` and `scripts`, and fails on:

- a cross-feature backend import that skips the target's `index`, or points to the same or a higher layer (including `shared` importing a feature);
- apps or scripts importing backend files instead of `@root-of-cambodia/backend/<entry>`, or an unknown entry;
- a relative import leaving a web feature;
- another feature's `components/`, `screens/` or internals imported from anywhere but a route;
- shared web code importing a feature;
- a `"use client"` file importing `@/server/*` or a feature's `server.ts`.

A table of deliberate violations in the same test proves each rule refuses them. Co-located `tests/` and `testing/` folders are exempt from the backend runtime import check because they run under Vitest.
