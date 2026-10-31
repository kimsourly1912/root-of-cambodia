# Feature-based code structure

**Status:** proposed target layout in [ADR 0008](decisions/0008-feature-based-modules.md); **not applied yet**. Until the ADR is accepted and its migration stage has landed, the current flat layout in the [architecture overview](overview.md#module-map) stays authoritative and new code follows it.

**Responsible role:** technical maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [77b992a](https://github.com/kimsourly1912/root-of-cambodia/commit/77b992a71ab4ceac8d9ba08abfa6c0133cc84c8a).

**Sources:** [packages/backend/src/](../../packages/backend/src/), [packages/backend/package.json](../../packages/backend/package.json), [apps/web/components/](../../apps/web/components/), [apps/web/src/](../../apps/web/src/), [apps/web/app/](../../apps/web/app/), [tests/](../../tests/), [vitest.backend.config.ts](../../vitest.backend.config.ts), [tests/workspace.test.ts](../../tests/workspace.test.ts).

This page is the standard for **where code goes**. The rules for *how* code behaves (atomic saves, commit-time checks, retries, privacy) stay in [AGENTS.md](../../AGENTS.md), the [overview](overview.md) and the [database contract](database.md). The layout only makes those rules easier to follow.

## The idea in one paragraph

Everything that belongs to one business area (rooms, bookings, payments, …) lives together in one feature folder: its services, reads, persistence, UI components, helpers and tests. Code goes to a shared root folder only when two or more features (or the app shell) use it. Build it inside the feature first; move it to shared when a second feature needs it. Other code reaches a feature only through that feature's public entry file.

## Target tree

~~~text
packages/backend/
├── src/
│   ├── shared/                      # kernel used by every feature; imports no feature
│   │   ├── errors.ts  operations.ts  access.ts  schema.ts  diagnostics.ts
│   │   └── index.ts                 # public API of the kernel
│   ├── features/
│   │   └── <feature>/
│   │       ├── index.ts             # PUBLIC API: the only file other code may import
│   │       ├── <name>.ts            # service: validation, permissions, rules
│   │       ├── <name>-queries.ts    # scoped, bounded reads
│   │       ├── <name>-persistence.ts# one named atomic save per operation
│   │       └── tests/*.test.ts      # native D1 tests for this feature
│   └── testing/                     # test-only support and fixtures (never exported)
├── tests/                           # cross-feature backend tests (migrations, safeguards, boundaries)
└── migrations/                      # unchanged: one ordered SQL directory for the whole schema

apps/web/
├── app/                             # Next.js routes only: THIN pages, layouts, route handlers
├── features/
│   └── <feature>/
│       ├── index.ts                 # PUBLIC client-safe API: building blocks, hooks, types
│       ├── server.ts                # PUBLIC server-only API: authorized reads/guards for pages and routes
│       ├── screens/                 # full-page compositions; imported only by app/ routes
│       ├── components/              # private components (forms, panels)
│       ├── hooks/                   # use-*.ts, private unless exported
│       ├── lib/                     # pure helpers (formatters, mappers)
│       └── tests/
├── components/
│   ├── ui/                          # shadcn primitives (Button, Card, Input, …)
│   └── *.tsx                        # app-shell components used by 2+ features (SignOut)
├── hooks/  lib/                     # shared across features only
└── server/                          # shared server-only adapters: http, sessions, runtime, policy

apps/jobs/src/                       # unchanged: scheduled/queue adapters calling backend feature APIs

tests/                               # whole-app tests that cross features
├── integration/                     # built-Worker HTTP, jobs runtime, staging runtime
├── e2e/                             # Playwright journeys (desktop + phone) and the test server
└── tooling/                         # workspace, boundary and state-handoff checks
~~~

## Rules

1. **Feature code lives in its feature folder.** Root `shared/`, `components/`, `hooks/`, `lib/` and `server/` hold only code used by two or more features or by the app shell. Start inside the feature; promote to shared when a second feature needs it, in the same PR as that second use.
2. **One public entry per side.**
   - Backend: `features/<feature>/index.ts` exports the services, read functions and types other code needs. Persistence functions are **not** exported; only the feature's own service and tests call them.
   - Web: `index.ts` is client-safe (components, hooks, types, pure helpers). `server.ts` is server-only (authorized reads, session guards). Never mix the two: a barrel that re-exports server code would pull it into the client bundle.
3. **Cross-feature imports go through the public entry only:** `@root-of-cambodia/backend/bookings`, `@/features/catalog`, `@/features/bookings/server`. Deep imports into another feature (`features/x/components/...`, `features/x/x-persistence`) and relative paths that leave the feature (`../../x`) are not allowed.
4. **Never export screens or forms from `index.ts`.** Export only building blocks: navigation, pickers, display components, formatters, hooks, types. Screens import other features' building blocks; building blocks do not import screens, so features cannot form cycles.
5. **Inside a feature, use relative imports** (`./room-queries`, `../components/room-type-form`). Use `@/` aliases only for shared code and other features' public entries.
6. **Routes in `apps/web/app/` stay thin.**
   - A `page.tsx` reads params, calls the feature's `server.ts` for the session guard and data, and renders one screen from `features/<feature>/screens/`. A screen is the **only** deep import a route may make.
   - A `route.ts` handler parses transport (session, Origin, body cap) with shared `server/` helpers and calls the backend feature's public API. Business rules never live in routes.
7. **Feature dependencies form a one-way graph** (see [layers](#feature-layers)). A feature may import a feature in a lower layer, never the same or a higher one. `shared/` imports no feature.
8. **Backend file names keep the existing convention:** `<name>.ts` (service), `<name>-queries.ts`, `<name>-persistence.ts`. Web files stay lowercase kebab-case; components export PascalCase names.
9. **Migrations stay in one ordered directory.** D1 applies one sequence; schema ownership per feature is recorded in the [database contract](database.md), not by splitting folders.
10. **Tests sit with the code they test.** A test that exercises one feature goes in that feature's `tests/`. Tests that cross features or test the whole Worker go in the root `tests/` (or `packages/backend/tests/` for backend-only cross-feature checks). Shared fixtures live in `packages/backend/src/testing/`.
11. **Feature folders are named after the business resource**, matching their API path and docs contract where possible (table below).

## Feature catalog

The backend folder names below are the target; "current files" lists what moves there. Web folders use the same names, so `features/payments/` exists on both sides.

| Feature | Current backend files | Current web pieces | Routes / API | Docs contract |
| --- | --- | --- | --- | --- |
| `shared` (backend kernel) | errors, operations, access, schema, diagnostics | `src/http.ts`, `owner-session.ts`, `guest-session.ts`, `public-http.ts`, `runtime.ts`, `runtime-policy.ts`, `return-path.ts`, `staging-accounts.ts` → `apps/web/server/` (the session/http adapters use the last two); `components/ui/`, `sign-out.tsx`, `lib/utils.ts` stay shared | — | [overview](overview.md), [database](database.md) |
| `accounts` | auth | `account-form.tsx`, `auth-form.tsx` | `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, `/api/auth` | [setup](../development/setup.md), [staging](../operations/staging.md) |
| `properties` | property-drafts, property-queries, property-persistence | `property-form.tsx`, `property-navigation.tsx` (public building block) | `/owner`, `/owner/properties/[id]`, `/api/owner/properties` | [owner supply](../features/owner-supply.md) |
| `property-information` | property-information, -queries, -persistence | `property-information-form.tsx` | `…/information` | [owner supply](../features/owner-supply.md) |
| `property-logistics` | property-logistics, -queries, -persistence | `property-logistics-form.tsx` | `…/logistics` | [owner supply](../features/owner-supply.md) |
| `media` | media, media-queries, media-persistence | `property-photos.tsx`, `src/media-http.ts`, `src/media-runtime.ts` | `…/photos` | [ADR 0004](decisions/0004-private-media-lifecycle.md) |
| `rooms` | room-types, room-queries, room-persistence | `room-type-form.tsx` | `…/rooms` | [owner supply](../features/owner-supply.md) |
| `calendar` | calendar, calendar-dates, calendar-queries, calendar-persistence | `room-calendar-form.tsx` | `…/rooms/[roomId]/calendar` | [owner supply](../features/owner-supply.md) |
| `inventory` | inventory, inventory-persistence | `inventory-night-form.tsx` | `…/availability`, `/api/inventory` | [owner inventory](../product/owner-inventory-operations.md) |
| `quotes` | quotes, quote-queries | — | `/api/booking-quotes` | [bookings](../features/bookings.md) |
| `payments` | payments, payment-queries, payment-persistence | `payment-records.tsx` | `/api/owner/bookings/[id]/payments` | [payments](../features/payments.md) |
| `notifications` | outbox | — | — | [notifications](../features/notifications.md) |
| `publication` | publication, publication-queries, publication-persistence, publication-readiness, **public-listing** | `publication-action.tsx`, `publication-checklist.tsx`, `review-snapshot.tsx`, `src/reviewer-read.ts` | `/review`, `…/review`, `/api/property-reviews` | [publication review](../features/publication-review.md), [ADR 0005](decisions/0005-public-listing-boundary.md) |
| `catalog` | catalog-queries | `public-stay-details.tsx`, `stay-photo.tsx` | `/stays`, `/api/stays` | [guest browsing](../features/guest-browsing.md) |
| `listing-controls` | listing-controls, listing-control-queries, listing-control-persistence | `listing-controls.tsx` | `…/listing` | [ADR 0007](decisions/0007-owner-listing-controls.md) |
| `bookings` | bookings, booking-persistence, booking-logistics, guest-bookings, owner-bookings, stay-queries | `booking-format.ts`, `booking-logistics.tsx`, `booking-review.tsx`, `guest-cancel.tsx`, `guest-request-form.tsx`, `owner-booking-response.tsx`, `owner-stay-action.tsx` | `/bookings`, `/stays/[id]/request`, `…/bookings`, `/api/bookings`, `/api/guest`, `/api/owner/bookings` | [bookings](../features/bookings.md), [ADR 0006](decisions/0006-booking-journey.md) |
| `external-bookings` | external-bookings, external-booking-queries, external-booking-persistence | `external-reservation-form.tsx`, `external-reservation-review.tsx` | `…/bookings/external`, `/api/external-reservations` | [owner inventory](../product/owner-inventory-operations.md) |
| `jobs` | jobs | — (apps/jobs) | scheduled/queue | [notifications](../features/notifications.md) |

`public-listing` moves into `publication` because it computes the public-display digest that review approval binds to, and today it already imports publication's `ReviewSnapshot` type while publication imports it back. Inside one feature that pair is no longer a cross-feature cycle.

## Feature layers

Derived from the current backend imports. A feature may import features in **lower** layers only.

| Layer | Features | Imports from lower layers |
| --- | --- | --- |
| 0 | `shared` | nothing |
| 1 | `accounts`, `properties`, `property-information`, `property-logistics`, `media`, `rooms`, `inventory`, `quotes`, `payments`, `notifications` | shared |
| 2 | `calendar` → rooms; `publication` → media | |
| 3 | `catalog` → publication, media | |
| 4 | `listing-controls` → catalog, publication; `bookings` → quotes, catalog, payments | |
| 5 | `external-bookings` → bookings, quotes; `jobs` → bookings, notifications | |

Adding a dependency that points sideways or upward means the code is in the wrong feature, or the shared piece belongs in a lower layer. Resolve it in the design, not with a deep import.

## Next.js versus the nuk-cafe (Nuxt) standard

The structure follows the same idea as the nuk-cafe admin's feature architecture. Terms differ:

| nuk-cafe (Nuxt/Vue) | This project (Next.js/React) |
| --- | --- |
| `app/pages/` thin route files | `apps/web/app/**/page.tsx` thin routes rendering a feature screen |
| `<Feature>ListPage.vue` | `features/<f>/screens/<name>-screen.tsx` |
| `composables/use<X>.ts` | `features/<f>/hooks/use-<x>.ts` |
| `schemas/<feature>-form.ts` (Valibot) | Request validation lives in backend services today; a web-side form schema would go in `features/<f>/lib/` |
| Auto-imported root code | No auto-imports: shared code is imported through `@/components`, `@/hooks`, `@/lib`, `@/server` |
| `server/` Nitro API | `app/api/**/route.ts` thin handlers + `packages/backend` features |
| `shared/contracts/` | Backend feature `index.ts` types (one library used by web and jobs) |
| Query keys / `invalidate()` | Not used: pages are server-rendered reads; client components refresh with `router.refresh()` after a write |
| ESLint boundary rules | Extended regex checks in the tooling test (no new lint dependency unless separately approved) |

## Adding a new feature

1. Confirm the behavior is accepted (see the [decision proposal](../playbooks/decision-proposal.md) and [feature slice](../playbooks/feature-slice.md) playbooks).
2. Pick a resource name and its layer. Check the layer table for allowed dependencies.
3. Backend: create `packages/backend/src/features/<name>/` with `index.ts`, the service/queries/persistence files and `tests/`. Add one `exports` entry: `"./<name>": "./src/features/<name>/index.ts"`.
4. Web: create `apps/web/features/<name>/` with only the folders you need. Routes in `app/` render a screen from it.
5. Add the row to the catalog above and to the [module map](overview.md#module-map), and write or update the feature contract in `docs/features/`.

## Enforcement

[tests/workspace.test.ts](../../tests/workspace.test.ts) already checks part of the dependency direction with regexes. The migration extends it, without new dependencies, to fail on:

- imports of `@root-of-cambodia/backend/<x>` where `<x>` is not a feature or `shared` entry;
- web imports of `@/features/<x>/…` other than `index`, `server` or (from `app/` only) `screens/…`;
- relative imports that leave a feature folder;
- a `"use client"` file importing a feature's `server.ts` or `@/server/*`;
- a backend feature importing a feature in the same or a higher layer.

Until that lands, these rules are review conventions, not automated guarantees.
