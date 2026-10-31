# Architecture overview

**Status:** accepted direction; current source layout.

**Responsible role:** technical maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026; module map and topology rechecked after the [ADR 0008](decisions/0008-feature-based-modules.md) feature reorganization (branch `refactor/feature-structure`).

**Sources:** [apps/web/server/runtime.ts](../../apps/web/server/runtime.ts), [apps/jobs/src/index.ts](../../apps/jobs/src/index.ts), [packages/backend/package.json](../../packages/backend/package.json), [tests/tooling/workspace.test.ts](../../tests/tooling/workspace.test.ts).

The system is a modular monolith with two runtime adapters using one shared backend library and initially one D1 database per environment. Shared code is not a third network service. [Status](../status.md) distinguishes local implementation from planned product and live verification.

## Current topology and responsibilities

| Location | Responsibility |
| --- | --- |
| [apps/web](../../apps/web/README.md) | Next.js App Router routes (`app/`), feature UI (`features/<feature>/`), shared UI (`components/`, `lib/`) and shared server adapters (`server/`) for OpenNext/Workers |
| [apps/jobs](../../apps/jobs/README.md) | Scheduled/queue entrypoints calling shared expiry, outbox and removed-photo maintenance |
| [packages/backend](../../packages/backend/README.md) | Framework-independent business services, scoped reads and named atomic D1 persistence in `src/features/<feature>/`, with the `src/shared/` kernel; one package entry per feature |
| [migrations](../../packages/backend/migrations/) | Authoritative ordered SQL schema, constraints, triggers and history |
| [tests](../../tests/) | Whole-app tests: `integration/` (built web/jobs Worker, staging runtime), `e2e/` (browser) and `tooling/` (workspace, handoff, feature boundaries). Feature tests live beside their feature |
| [proofs/foundation](../../proofs/foundation/README.md) | Independent historical npm compatibility fixture, outside the active workspace |
| [handoff-local.ts](../../scripts/handoff-local.ts) | Imports ignored state from a legacy `application/` folder in older checkouts (the tracked folder was removed by the owner on 31 October 2026); preserve until a separately reviewed state migration |

Next.js/React/TypeScript, shadcn/Radix/Tailwind and bundled Khmer fonts remain selected. Better Auth uses native D1 and server sessions. Drizzle provides selected reads; it is not a replacement for atomic D1 operations or SQL migrations. OpenNext generates the web Worker and assets; jobs is a separate Worker. R2 stores private objects and Images processes previews. Current bindings/providers are local substitutes.

## Dependency direction and module rules

1. Routes/pages adapt transport/session/runtime and call a service or authorized read. Server-rendered pages may use those reads directly; they need not call their own HTTP API.
2. Services coordinate validation, permissions, quotes and business rules. They must not split one booking write across independent commits.
3. Query helpers own scoped projections and bounded reads; internal booking/catalog helpers require an already verified service context, while the separately allowlisted public catalog checks explicit publication/disclosure eligibility without a session.
4. Named persistence owns a complete operation batch, write-time checks and receipt. Constraints/triggers protect bounded critical effects.
5. Jobs calls the same lifecycle/delivery services. Providers run after business commit; email failure does not roll back a booking.
6. Backend must not import Next.js, React or either app. Browser code must not import bindings, persistence or secrets. Use explicit existing types and boundary interfaces where useful.

The backend package exports one entry per feature plus `shared`; persistence modules are not exported. The [tooling test](../../tests/tooling/workspace.test.ts) enforces the [feature structure](feature-structure.md#enforcement) rules: index-only cross-feature imports, the backend [layer order](feature-structure.md#feature-layers), no backend file imports from apps, and no server-only imports in client components. It is a regex check, not a type-level guarantee; review still matters for anything it cannot see, such as dynamic imports built from strings.

## Module map

Backend folders under `packages/backend/src/`; the web side uses the same feature names under `apps/web/features/`. The [feature catalog](feature-structure.md#feature-catalog) lists every file, route and docs contract.

| Responsibility | Folder (files) |
| --- | --- |
| Kernel: errors, verified actor/operations, access, schema, diagnostics, outbox | `shared/` |
| Identity | `features/accounts/` (auth) |
| Draft properties | `features/properties/` (property-drafts, -queries, -persistence) |
| Rooms and calendar | `features/rooms/` (room-types, room-queries, room-persistence); `features/calendar/` (calendar, calendar-dates, -queries, -persistence) |
| Property information and media | `features/property-information/`; `features/media/` (media, media-queries, media-persistence) |
| Private location/contact/arrival | `features/property-logistics/`; private source details, separately authorized acceptance copies |
| Pilot publication review and public projection | `features/publication/` (publication, -queries, -persistence, -readiness, public-listing); configured single reviewer, shared completeness predicates, explicit terms gate, display-version/digest binding |
| Guest browsing | `features/catalog/` (catalog-queries); current eligibility and processed-only media |
| Quotes | `features/quotes/` (quotes, quote-queries) |
| Bookings and stays | `features/bookings/` (bookings, booking-persistence, booking-logistics, guest-bookings, owner-bookings, stay-queries); journey projections, recovery, acceptance copies, scheduled arrival and manual completion |
| Owner external reviews | `features/external-bookings/`; catalog-priced anonymous allocation reviews over the booking engine |
| Property payment bookkeeping | `features/payments/`; full immutable-total attestation, owner-private correction history, guest-safe summary |
| Inventory | `features/inventory/` (inventory, inventory-persistence) |
| Scheduled maintenance | `features/jobs/` (jobs) |

Use straightforward typed functions and existing patterns. Do not introduce generic table repositories, a new framework/ORM or speculative modules. New code follows the [feature structure](feature-structure.md). Broader support/admin and money-moving payment processing need separately approved contracts; do not scaffold speculative modules.

Owner visibility uses `features/listing-controls/` (listing-controls, -queries, -persistence) with the shared owner operation receipt and immutable listing_control_event ledger; [ADR 0007](decisions/0007-owner-listing-controls.md) records accepted pause/resume and later offline corrections.

## Consistency, growth and operations

Keep booking status, allocations, immutable snapshots, history/outbox and success receipt atomic. Keep private responses out of shared caches and media private. Public catalog caching, when implemented, cannot replace authoritative booking-time price/availability checks.

One D1 database keeps an operation's writes together; it does not imply unlimited throughput/storage. Measure indexed, bounded pilot workloads before partitioning or changing database technology. D1-specific SQL/trigger changes or partitioning require a separate decision and migration evidence.

Local, staging and production need distinct resources/secrets/data. Current runtime providers intentionally fail closed outside local mode; do not bypass guards to make a deploy pass. See [release and recovery](../operations/release-and-recovery.md).

## Decision records

- [0001: Modular monolith on Workers](decisions/0001-modular-monolith.md): accepted direction, transcribed from owner-approved architecture.
- [0002: Atomic booking persistence](decisions/0002-atomic-booking-operations.md): accepted detailed design.
- [0003: pnpm workspace](decisions/0003-pnpm-workspace.md): accepted tooling amendment superseding active npm guidance.
- [0004: Private media lifecycle](decisions/0004-private-media-lifecycle.md): records implemented engineering pattern within approved R2/Images direction; retention/public delivery remain open.

- [0005: Public listing boundary](decisions/0005-public-listing-boundary.md): accepted allowlist, explicit owner display acknowledgement and routed processed-only reads; originals stay private.

- [0006: Booking journey and private disclosure](decisions/0006-booking-journey.md): accepted D17 and staged guest/owner screens; server-saved request recovery, immutable configured terms and atomic acceptance-time logistics copies.

- [0007: Owner listing visibility and reviewed corrections](decisions/0007-owner-listing-controls.md): accepted and implemented in PRs #33 and #34.

- [0008: Feature-based code organization](decisions/0008-feature-based-modules.md): accepted and applied; layout and rules in [feature structure](feature-structure.md).

The [database contract](database.md), [features](../README.md#feature-contracts), [contributing standard](../development/contributing.md) and [open decisions](../product/open-decisions.md) provide detail.

## Temporary staging without email — 30 October 2026

The owner deferred Cloudflare Email Sending and requested testing of implemented
features. The [staging contract](../operations/staging.md) admits the exact origin
with APP_MODE=staging-test and three fictional fixture identities. They use normal
Better Auth password sessions, private supplied passwords and unchanged backend
verification/ownership rules. Synthetic fixture verification makes no claim about
an actual inbox. Public registration, verification, reset and account changes are
refused before Better Auth. Shared private adapters and SSR recheck fixture IDs.
Local capture remains loopback-only; staging mail throws and jobs is unscheduled.
The retained staging-read-only mode refuses all auth/business mutations. Neither
mode admits production or any other origin. No Access organization was created.
