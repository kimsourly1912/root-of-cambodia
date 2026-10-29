# Root of Cambodia web application

The Next.js application now lives in apps/web and imports the private packages/backend workspace; the historical compatibility proof remains in ../../proofs/foundation. Next.js full stack, Better Auth, D1 and Drizzle are retained. The first shadcn/ui/Tailwind interface now provides verified owner access and private property draft create/edit/reopen. Payment remains at the property.

## Local validation

Use Node 24.22.1. Dependencies are pinned; packageManager records pnpm 12.15.0. Earlier reports retain their historical npm results. See the [pnpm review](../../docs/Root-of-Cambodia-Pnpm-Workspace-Review.md) for the new verification.

~~~sh
cd ../.. # repository root
pnpm install --frozen-lockfile
pnpm run init:local
pnpm run types:bindings
pnpm run typecheck
pnpm run test:backend
pnpm run build:worker
pnpm run build:jobs
pnpm run test:worker
pnpm test
~~~

Run these commands from the repository root using Node 24.22.1 and pnpm 12.15.0. There is one active root pnpm lockfile. The historical proof remains outside the workspace with its original npm lockfile.

init:local applies the single authoritative migration set from packages/backend/migrations through the web configuration. It creates local-only auth-mail and notification capture tables without seeding business properties. Repeating initialization preserves data and skips applied migrations. Web and jobs previews use the same root .wrangler/state path and unchanged local database ID. Stop local previews before the first handoff. For an existing checkout, the initializer copies legacy application/.dev.vars and application/.wrangler/state once, retains the originals, and rejects conflicting destinations. The marker prevents a later run from overwriting newer workspace data. Reconcile conflicts explicitly; do not delete a populated database to force initialization.

Tests use isolated synthetic databases. The retained baseline reported 77 tests: 72 native D1/runtime scenarios, three workspace/handoff checks and two built-Worker journeys. The web journey retains its 12 HTTP checks; the jobs journey exercises the prebuilt jobs bundle, scheduled expiry and actual local queue delivery. Both builds are required before pnpm test. See the [workspace review](../../docs/Root-of-Cambodia-Workspace-Review.md) for verification and limits.

The checked-in configurations and capture adapters are local-only; they send no real email and fail closed outside local mode. build:jobs uses Wrangler's --dry-run to write a local bundle. No deployment command or live sending provider is configured. Do not deploy these local configurations as production.

## Owner preview and browser checks

From the repository root, run `pnpm preview:worker` after initialization and building. Open http://127.0.0.1:8787/owner. Email is captured locally; no inbox delivery is configured. After signup, read the local link in another terminal:

```sh
pnpm --filter @root-of-cambodia/web exec wrangler d1 execute DB --local --persist-to ../../.wrangler/state --command "SELECT recipient,kind,url FROM local_email ORDER BY rowid DESC LIMIT 5"
```

Open the captured verification/reset URL locally. These links are account credentials; keep capture output out of Git. No product mail-reading API exists.

Stop a preview using port 8787 before browser tests. After `pnpm build:worker`:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

The tests start the actual built Worker with isolated D1 and a test-only loopback bridge. They do not use the preview database. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an existing browser executable. See the [owner-draft review](../../docs/Root-of-Cambodia-Owner-Drafts-Review.md) for the tested version and current evidence.

The five UI primitives in components/ui came from the official shadcn/ui New York registry, with local styling/touch-target changes; its [MIT notice](components/ui/LICENSE.md) is retained. Fonts are self-hosted through the pinned Fontsource package. UI packages and Playwright are new approved-stack additions; all 493 existing locked package artifacts retain their versions/integrities.

## Service and persistence boundaries

bookings.ts, quotes.ts and inventory.ts coordinate validation and permissions. access.ts keeps the authorized Drizzle booking read and scoped resource checks; quote-queries.ts holds internal catalog reads. booking-persistence.ts exposes commitRequest, commitBookingTransition and expireRequest. inventory-persistence.ts exposes editInventoryNight. Each save owns the complete atomic batch through the existing operations.ts primitive; never commit its individual table writes separately.

property-drafts.ts validates private draft fields/access; property-queries.ts exposes only owned projections and paginates; property-persistence.ts owns complete draft create/edit batches. Migration 0005 adds immutable, attributable draft events without changing existing catalog/booking records. Current publication/revision/verified-actor checks run inside each save. Uncertain saves replay the same fingerprint/receipt; changing the payload under the same key conflicts. See the [owner-draft review](../../docs/Root-of-Cambodia-Owner-Drafts-Review.md).

Services authorize before receipt replay. Submission prepares a fresh quote lazily, only when no matching receipt exists, preserving retries after catalog changes. Routes and jobs.ts call the same services. See the [service-boundary review](../../docs/Root-of-Cambodia-Service-Boundaries.md) for contracts and local verification. The eight added boundary tests preserve all 52 previous D1 scenarios; step 3 reported 61 tests including the rebuilt-Worker journey. The current workspace suite adds only the boundary/entrypoint risks described above.

## Persistence and operation contracts

Migration 0004 adds database guards for command/status consistency, the supported pre-check-in cancellation cutoff, non-null business identities, coherent Cambodia schedules and stable operation receipts. It checks existing records first and rejects incompatible data without rewriting history. Use the migration runner atomically; a failed preflight needs a reviewed repair plan. See the [safeguards review](../../docs/Root-of-Cambodia-Database-Safeguards.md) for fresh/populated upgrade evidence, exact command mapping and limits.

- SQL migrations are authoritative, including composite FKs, CHECK constraints, delete restrictions and triggers. schema.ts provides Drizzle read projections; do not replace migrations with drizzle-kit push.
- 0001 creates identity/catalog/inventory/rates; 0002 creates booking operations/history/outbox; 0003 adds delivery recovery diagnostics/indexes; 0004 adds booking/identity/receipt safeguards; 0005 adds private draft history. These do not upgrade the disposable proof database.
- Quotes use server-side settings, nightly rates and itemized per-stay mandatory charges. Submission recalculates the quote/hash and rechecks revisions, availability and complete coverage inside one D1 batch.
- Internal building state is sealed to pending/confirmed before commit and is excluded from public reads.
- Stable lines retain quantities, adult/child counts, capacity limits, room names and occupied-night prices. Headers retain property/guest names, guest email, dates, UTC check-in/out, timezone, arrival/departure times, USD total, policy text/version, terms version and cancellation wording.
- Mutations require a scoped Idempotency-Key: 1–128 ASCII letters/digits/colon/underscore/hyphen. Reuse the same key and normalized payload after a timeout/503. Receipts survive later price/state changes; changed payloads conflict. Receipt retention needs an approved policy.
- Critical operations use D1 batches/triggers. Zero-row mutations cannot commit success receipts or side effects. History records actor ID and role. Raw D1 access remains trusted infrastructure.
- Inventory edits use optimistic revisions and cannot edit reserved counters. Catalog/calendar/rate creation interfaces remain future work.

## API

Application endpoints return a server-generated X-Request-Id on success and error without changing their response bodies/statuses. Private structured diagnostics use that reference, never raw payloads or credentials. See the [step 5 review](../../docs/Root-of-Cambodia-Diagnostics-Delivery-Review.md). Better Auth endpoints keep their separate library handler contract.

All application endpoints require verified cookie sessions. Mutations require the configured Origin and application/json; bodies are limited to 32 KiB. Responses are private/no-store.

| Endpoint | Contract |
| --- | --- |
| GET /api/owner/properties | Own property list; up to 20 entries, optional cursor |
| POST /api/owner/properties | Own private draft; ownerName, nameKm, optional nameEn, province, checkinTime, checkoutTime, policyText and Idempotency-Key; 201 receipt |
| GET /api/owner/properties/:id | Own property details only |
| PATCH /api/owner/properties/:id | Same draft fields without ownerName, plus expected revision and Idempotency-Key; draft status only; 200 receipt |
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

The shared jobs.ts exposes bounded maintenance/consume operations. apps/jobs now provides thin scheduled/queue entrypoints and local queue/capture adapters; live bindings/provider remain unconfigured. No automatic Cron schedule is enabled. maintenance expires due requests and republishes due outbox IDs. consume claims a lease and invokes the injected provider.

Pending rows and expired sending leases remain discoverable: publication never sets a permanent published bit. Queue duplicates are safe. Attempts record started/delivered/retry and sanitized failure codes. Backoff starts at 60 seconds and caps at one hour. Five-minute fenced leases recover process death. All sends reuse the outbox ID as provider idempotency key. Provider support, timeout/deduplication windows and operator/dead-letter policy need staging validation. Exactly-once inbox delivery is not promised. New results use provider_accepted/retry_scheduled/not_claimed/lease_superseded and always report inboxDelivery=unknown. Legacy delivered fields record adapter acceptance only; they are not inbox evidence.

No reminder schedule, no-show rule, late-cancellation fee or admin impersonation was invented. See the [backend foundation review](../../docs/Root-of-Cambodia-Backend-Foundation-Review.md) for decisions and release gates.
