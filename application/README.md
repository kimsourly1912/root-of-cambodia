# Root of Cambodia application backend

This is the application foundation; the historical compatibility proof remains in ../proofs/foundation. Next.js full stack, Better Auth, D1 and Drizzle are retained. The shadcn/ui interface is a later task. Payment remains at the property.

## Local validation

Use Node 24.22.1. Dependencies are pinned. packageManager records npm 11.9.0; the safeguards verification also ran npm 11.9.0 (the earlier runner review used npm 11.19.1).

~~~sh
npm ci
npm run init:local
npm run types:bindings
npm run typecheck
npm run test:backend
npm run build:worker
npm run test:worker
npm test
~~~

init:local creates a random ignored secret, applies versioned migrations through Wrangler locally, and creates a local-only email capture table. It does not seed business properties. Re-running it preserves existing data and skips applied migrations. Tests create disposable synthetic catalogs/accounts. The HTTP harness applies the same migrations to its isolated database. Vitest now runs both projects: 60 backend scenarios in the Workers runtime and one built-Worker journey preserving all 12 HTTP checks. npm test runs both and requires the current bundle from build:worker; test:backend can run the shared-service scenarios separately. See the [Vitest alignment report](../docs/Root-of-Cambodia-Vitest-Alignment.md) for versions, verification and the existing dependency audit finding.

The checked-in configuration is local-only. runtime.ts fails closed outside local capture mode. There is no deployment script, live sending provider or public infrastructure in this change. Do not deploy this configuration as production.

## Service and persistence boundaries

bookings.ts, quotes.ts and inventory.ts coordinate validation and permissions. access.ts keeps the authorized Drizzle booking read and scoped resource checks; quote-queries.ts holds internal catalog reads. booking-persistence.ts exposes commitRequest, commitBookingTransition and expireRequest. inventory-persistence.ts exposes editInventoryNight. Each save owns the complete atomic batch through the existing operations.ts primitive; never commit its individual table writes separately.

Services authorize before receipt replay. Submission prepares a fresh quote lazily, only when no matching receipt exists, preserving retries after catalog changes. Routes and jobs.ts call the same services. See the [service-boundary review](../docs/Root-of-Cambodia-Service-Boundaries.md) for contracts and local verification. The eight added boundary tests preserve all 52 previous D1 scenarios; combined npm test now reports 61 tests including the rebuilt-Worker journey.

## Persistence and operation contracts

Migration 0004 adds database guards for command/status consistency, the supported pre-check-in cancellation cutoff, non-null business identities, coherent Cambodia schedules and stable operation receipts. It checks existing records first and rejects incompatible data without rewriting history. Use the migration runner atomically; a failed preflight needs a reviewed repair plan. See the [safeguards review](../docs/Root-of-Cambodia-Database-Safeguards.md) for fresh/populated upgrade evidence, exact command mapping and limits.

- SQL migrations are authoritative, including composite FKs, CHECK constraints, delete restrictions and triggers. schema.ts provides Drizzle read projections; do not replace migrations with drizzle-kit push.
- 0001 creates identity/catalog/inventory/rates; 0002 creates booking operations/history/outbox; 0003 adds delivery recovery diagnostics/indexes; 0004 adds booking/identity/receipt safeguards. These do not upgrade the disposable proof database.
- Quotes use server-side settings, nightly rates and itemized per-stay mandatory charges. Submission recalculates the quote/hash and rechecks revisions, availability and complete coverage inside one D1 batch.
- Internal building state is sealed to pending/confirmed before commit and is excluded from public reads.
- Stable lines retain quantities, adult/child counts, capacity limits, room names and occupied-night prices. Headers retain property/guest names, guest email, dates, UTC check-in/out, timezone, arrival/departure times, USD total, policy text/version, terms version and cancellation wording.
- Mutations require a scoped Idempotency-Key: 1–128 ASCII letters/digits/colon/underscore/hyphen. Reuse the same key and normalized payload after a timeout/503. Receipts survive later price/state changes; changed payloads conflict. Receipt retention needs an approved policy.
- Critical operations use D1 batches/triggers. Zero-row mutations cannot commit success receipts or side effects. History records actor ID and role. Raw D1 access remains trusted infrastructure.
- Inventory edits use optimistic revisions and cannot edit reserved counters. Catalog/calendar/rate creation interfaces remain future work.

## API

All application endpoints require verified cookie sessions. Mutations require the configured Origin and application/json; bodies are limited to 32 KiB. Responses are private/no-store.

| Endpoint | Contract |
| --- | --- |
| POST /api/booking-quotes | propertyId, checkin, checkout, termsVersion, lines; returns hash, nightly prices, charges and policy |
| POST /api/bookings | Selection + quoteHash + Idempotency-Key; returns Pending, never confirmation |
| GET /api/bookings/:id | Own guest booking or booking for a currently owned property |
| POST /api/bookings/:id/accept | Owner; unexpired Pending; atomic allocation/history/outbox |
| POST /api/bookings/:id/decline | Owner; unexpired Pending |
| POST /api/bookings/:id/cancel_guest | Guest's own pre-check-in Pending/Confirmed |
| POST /api/bookings/:id/cancel_owner | Owner; pre-check-in Pending/Confirmed; reason required |
| POST /api/bookings/:id/check_in | Explicit arrival_policy_decision_required error |
| POST /api/bookings/:id/complete | Owner; Checked in only; retain occupied-night allocations |
| POST /api/external-reservations | Owner; preview:true returns hash; submission reserves immediately |
| POST /api/inventory | roomId, night, capacity, blocked, revision; owner only |
| /api/auth/* | Better Auth email/password, verification, sessions and reset |

Each line has roomId, quantity, adults and children. Infant/unknown occupancy fields fail validation pending age/infant decisions. Aggregate configured capacities are checked; detailed party distribution is not inferred. External entry records anonymous catalog-priced reservations, not external guest accounts or evidence of guest consent. Contact entry and externally negotiated prices need a later contract.

Engineering ceilings: 10 lines, quantity 100, 60 total line/night rows, 366 calendar days, 20 charges, USD 10 million total and USD 1 million per unit night/charge. These are database/request safeguards, not agreed commercial stay rules. Pilot limits/load testing remain open.

## Jobs and delivery

jobs.ts exposes bounded maintenance/consume contracts for planned Cron/Queues entrypoints; live bindings/provider are unconfigured. maintenance expires due requests and republishes due outbox IDs. consume claims a lease and invokes the injected provider.

Pending rows and expired sending leases remain discoverable: publication never sets a permanent published bit. Queue duplicates are safe. Attempts record started/delivered/retry and sanitized failure codes. Backoff starts at 60 seconds and caps at one hour. Five-minute fenced leases recover process death. All sends reuse the outbox ID as provider idempotency key. Provider support, timeout/deduplication windows and operator/dead-letter policy need staging validation. Exactly-once inbox delivery is not promised.

No reminder schedule, no-show rule, late-cancellation fee or admin impersonation was invented. See ../docs/Root-of-Cambodia-Backend-Foundation-Review.md for decisions and release gates.
