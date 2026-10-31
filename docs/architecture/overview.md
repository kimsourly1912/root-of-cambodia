# Architecture overview

**Status:** accepted direction; current source layout.

**Responsible role:** technical maintainer (responsibility, not an assigned person).

**Last source verification:** 30 October 2026; owner-response implementation based on guest PR #25 head [a5bf41f](https://github.com/kimsourly1912/root-of-cambodia/commit/a5bf41ff6d54351358cd307b5ef4b9ded3f9d233).

**Sources:** [apps/web/src/runtime.ts](../../apps/web/src/runtime.ts), [apps/jobs/src/index.ts](../../apps/jobs/src/index.ts), [packages/backend/package.json](../../packages/backend/package.json), [tests/workspace.test.ts](../../tests/workspace.test.ts).

The system is a modular monolith with two runtime adapters using one shared backend library and initially one D1 database per environment. Shared code is not a third network service. [Status](../status.md) distinguishes local implementation from planned product and live verification.

## Current topology and responsibilities

| Location | Responsibility |
| --- | --- |
| [apps/web](../../apps/web/README.md) | Next.js App Router/React UI, authorized server reads, thin HTTP handlers and OpenNext/Workers runtime/media adapters |
| [apps/jobs](../../apps/jobs/README.md) | Scheduled/queue entrypoints calling shared expiry, outbox and removed-photo maintenance |
| [packages/backend](../../packages/backend/README.md) | Framework-independent business services, scoped reads, named atomic D1 persistence, diagnostics and provider contracts |
| [migrations](../../packages/backend/migrations/) | Authoritative ordered SQL schema, constraints, triggers and history |
| [tests](../../tests/) | Native Workers/D1, built-Worker HTTP/jobs, tooling/state-handoff and browser verification |
| [proofs/foundation](../../proofs/foundation/README.md) | Independent historical npm compatibility fixture, outside the active workspace |
| [application](../../application/) and [handoff-local.ts](../../scripts/handoff-local.ts) | Legacy ignored-state compatibility bridge; preserve until a separately reviewed state migration |

Next.js/React/TypeScript, shadcn/Radix/Tailwind and bundled Khmer fonts remain selected. Better Auth uses native D1 and server sessions. Drizzle provides selected reads; it is not a replacement for atomic D1 operations or SQL migrations. OpenNext generates the web Worker and assets; jobs is a separate Worker. R2 stores private objects and Images processes previews. Current bindings/providers are local substitutes.

## Dependency direction and module rules

1. Routes/pages adapt transport/session/runtime and call a service or authorized read. Server-rendered pages may use those reads directly; they need not call their own HTTP API.
2. Services coordinate validation, permissions, quotes and business rules. They must not split one booking write across independent commits.
3. Query helpers own scoped projections and bounded reads; internal booking/catalog helpers require an already verified service context, while the separately allowlisted public catalog checks explicit publication/disclosure eligibility without a session.
4. Named persistence owns a complete operation batch, write-time checks and receipt. Constraints/triggers protect bounded critical effects.
5. Jobs calls the same lifecycle/delivery services. Providers run after business commit; email failure does not roll back a booking.
6. Backend must not import Next.js, React or either app. Browser code must not import bindings, persistence or secrets. Use explicit existing types and boundary interfaces where useful.

Package exports currently expose low-level modules too. These are conceptual boundaries, not a claim that exports or comprehensive import enforcement already prevent bypass. The existing regex-based workspace test checks only part of the dependency direction. Narrow export/contract surfaces and stronger boundary checks are proposed follow-ups, not implemented by this phase.

## Module map

| Responsibility | Current files under packages/backend/src |
| --- | --- |
| Identity/access | `auth.ts`, `access.ts`, `operations.ts` verified actor primitive |
| Draft properties | `property-drafts.ts`, `property-queries.ts`, `property-persistence.ts` |
| Rooms/calendar | `room-types.ts`, `room-queries.ts`, `room-persistence.ts`; `calendar.ts`, `calendar-dates.ts`, `calendar-queries.ts`, `calendar-persistence.ts` |
| Property information/media | `property-information*.ts`; `media.ts`, `media-queries.ts`, `media-persistence.ts` |
| Private location/contact/arrival | property-logistics.ts, property-logistics-queries.ts, property-logistics-persistence.ts; private source details, separately authorized acceptance copies |
| Pilot publication review | publication.ts, publication-queries.ts, publication-persistence.ts, publication-readiness.ts; configured single reviewer, shared completeness predicates and explicit terms gate |
| Guest browsing | public-listing.ts and catalog-queries.ts; explicit public projection, display-version/digest binding, current eligibility and processed-only media |
| Booking/quotes | `bookings.ts`, `quotes.ts`, `quote-queries.ts`, `booking-persistence.ts`; `guest-bookings.ts`, `owner-bookings.ts`, `booking-logistics.ts` for private journey projections/recovery/acceptance copies |
| Owner external reviews | external-bookings.ts, external-booking-queries.ts, external-booking-persistence.ts; saved catalog-priced anonymous allocation reviews/recovery over the existing booking engine |
| Stay actions | `stay-queries.ts`, existing `bookings.ts`/`booking-persistence.ts`; exact scheduled arrival window and manual completion |
| Property payment bookkeeping | `payments.ts`, `payment-queries.ts`, `payment-persistence.ts`; full immutable-total attestation, owner-private correction history and independent guest-safe summary |
| Inventory | `inventory.ts`, `inventory-persistence.ts` |
| Delivery/diagnostics | `jobs.ts`, `outbox.ts`, `diagnostics.ts`, `errors.ts` |

Use straightforward typed functions and existing patterns. Do not introduce generic table repositories, services, a new framework/ORM or feature folders just to match a proposed tree. A feature-based layout is **proposed** in [ADR 0008](decisions/0008-feature-based-modules.md) with its target in [feature structure](feature-structure.md); until it is accepted and applied, keep this flat layout. Broader support/admin and money-moving payment processing need separately approved contracts; do not scaffold speculative modules.

Owner visibility uses listing-controls.ts, listing-control-queries.ts and listing-control-persistence.ts with the shared owner operation receipt and immutable listing_control_event ledger; [ADR 0007](decisions/0007-owner-listing-controls.md) records accepted pause/resume and later offline corrections.

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

- [0008: Feature-based code organization](decisions/0008-feature-based-modules.md): **proposed**; target layout in [feature structure](feature-structure.md), staged migration, no code moved yet.

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
