> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Backend-Foundation-Review.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Backend-Foundation-Review.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/architecture/database.md](../../architecture/database.md), [docs/features/bookings.md](../../features/bookings.md), [docs/status.md](../../status.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia — Backend Foundation Review

Date: 28 October 2026

## Outcome and evidence boundary

The repository previously contained plans and a disposable compatibility proof, not an application backend. This change introduces application/ with versioned SQL migrations, Next.js routes, verified Better Auth sessions, Drizzle reads, atomic booking/inventory operations and recoverable notification contracts. shadcn/ui remains the interface choice. Guests pay at the property.

PR #1 was checked through GitHub before implementation: **open and unmerged**, head 3d48fe74801a48f7b3bf5c1b1c62450821b7c899. This work started from codex/booking-review-and-mockup-brief. A final GitHub check found #1 had subsequently merged at 07:41 UTC (14:41 Cambodia time), merge commit 62746133cb0bcf04c0f485510db53f926ffcfecc. The new branch was updated onto current main and its PR targets main directly. This task did not merge or deploy anything.

All results below are local evidence, not production verification. The original proof's 18 D1 tests and 9 HTTP checks remain historical results. The proof is untouched and is not a production migration source.

## Findings and tested changes

| Area | Finding | Implemented behavior |
| --- | --- | --- |
| Schema | No application migrations existed | Auth, owner profile, place/property/room, inventory/rates, booking lines/nights/charges, allocation, operation receipt, history, outbox and delivery-attempt migrations |
| Relationships | Proof implemented only a subset | Auth-backed owners/guests; composite booking/property and room/property FKs prevent cross-property lines; allocations reference stable lines and inventory nights |
| Deletion/indexes | Retention procedure undecided | RESTRICT business relationships; snapshot/booking/event deletion blocked; auth session/account cascades retain generated library behavior; ownership, discovery, booking, expiry, allocation and due/leased delivery indexes |
| Submission | No authoritative request endpoint | Server computes integer USD prices and itemized per-stay charges, checks configured occupancy/publication/calendar/rates, and rechecks revisions inside commit |
| Snapshots | Full line/policy model missing | Immutable property/guest names, guest email, dates/instants, timezone, arrival/departure times, policy text/version, terms version, cancellation wording, room names/quantities/capacities, adult/child counts, nightly prices, charges and total |
| Dates | Submission lead time unimplemented | Asia/Phnom_Penh; database-time >=24-hour lead; expiry = database submission +12 hours; acceptance/decline strictly before expiry; checkout excluded |
| Inventory | External entry/versioned edits missing | External/online reservations use one allocation invariant; block/capacity edits use revisions and cannot displace confirmed stock; cancellation releases unreleased allocations once |
| Retries | No durable operation recovery | Actor-scoped keys, normalized fingerprints, atomically stored original result, changed-payload conflict and ambiguous commit-timeout recovery |
| Authorization | Proof route too narrow | Server session supplies actor ID; D1 rechecks verification; scoped guest/owner reads; mutation SQL rechecks ownership; history preserves actor ID and role |
| Lifecycle | Incomplete audit/outbox | Submission, confirmation, decline, expiry, cancellation and completion write history/outbox atomically; completion retains occupied-night allocations |
| Notifications | No publication/recovery contract | Opaque queue IDs, sweepable outbox, fenced leases, attempt records, sanitized errors, retry backoff and stable provider keys |
| HTTP | New routes needed direct protection | Exact Origin + JSON; 32 KiB streaming limit; private/no-store success/errors; verified sessions; bounded input; generic retry-same-key response for uncertain failures |
| Auth | Persistent throttling required | Generated Better Auth database rateLimit table; verified login/reset flows exercised with local captured email |

Raw SQL/database administration remains trusted infrastructure. Triggers protect invariants and operation context; they do not replace session authorization. No client-settable admin role or implicit admin booking access was added. Audited support access remains a release gate.

## Migration contracts

1. 0001_identity_catalog.sql includes reviewed Better Auth 1.7.14-generated auth tables, the generated rate-limit table, ownership, catalog, inventory and rates.
2. 0002_booking_operations.sql adds snapshots, stable lines, allocation/release, receipts, actor-aware history and outbox.
3. 0003_delivery_recovery.sql adds a nullable sanitized attempt error code, expired-lease index and immutable calendar/room identity guards.

Fresh-install tests check FK consistency, required indexes and parity with Better Auth's migration generator. Upgrade tests populate identity/catalog/session data before 0002, then bookings/allocations/history/outbox/attempts before 0003; data and recoverability survive. Wrangler's actual local migration runner applied all three files; local setup reruns skip applied files.

These migrations do **not** upgrade proofs/foundation/schema/booking.sql. That schema was disposable; no production data conversion is authorized or assumed. Future proof/legacy imports need a separate reviewed conversion. SQL is the migration authority; schema.ts provides Drizzle read projections. Do not use drizzle-kit push to replace reviewed trigger/constraint definitions.

Business deletion/erasure, archival and receipt cleanup await an approved retention policy. They are blocked rather than silently cascading booking history away.

## Validation

| Check | Observed local result |
| --- | --- |
| New application D1/workerd tests | 24 passed |
| Built Next.js/OpenNext Worker HTTP checks | 12 passed |
| TypeScript | Passed |
| Next.js production build | Passed |
| OpenNext Cloudflare Worker bundle | Passed |
| Wrangler local migrations | Three applied; rerun skipped applied files |
| Auth schema parity | No missing generated tables, columns or indexes |

Environment: Windows, Node 24.22.1, npm 11.19.1; pinned Next.js 16.4.3, OpenNext 1.20.13, Better Auth 1.7.14, Drizzle 0.45.4 and Wrangler 4.154.0. packageManager retains the proof's npm 11.9.0 declaration; this run used the available version noted here. OpenNext emitted its Windows compatibility advisory; build and local built-Worker checks passed.

The D1 suite covers multi-room snapshots/totals, missing rates/calendar, foreign-property rooms, canonical dates, occupancy overflow, changed quotes, paused publication, simultaneous last-room acceptance, last-night rollback, external/online contention, blocking/acceptance and acceptance/cancellation races, revision conflicts, cancellation attribution/reason, one-time release, no stock creation on decline/expiry, exactly-at-expiry rejection before cron, overlapping expiry sweeps, both sides of the 24-hour lead boundary, rate changes during commit, replay/conflicting payloads, ambiguous commit timeouts, snapshot/history immutability, scoped reads, completion retention, provider failure, duplicate delivery, missed publication, expired leases and provider-success/database-acknowledgement recovery.

HTTP checks exercise the actual built Worker: Khmer SSR, generated auth schema, captured verification mail, cookie sessions, anonymous/origin rejection, authoritative quotes/submission/replay, private-data isolation, last-room contention, cancellation retries, explicit unresolved-policy errors, JSON bounds, password reset, persistent throttling and verification revocation despite an existing cookie. No live email or production D1 is used.

Reproduction commands: [application/README.md](readmes/web-README.md). Historical proof files remain unchanged.

## Remaining decisions and release gates

| Decision/gate | Current explicit behavior |
| --- | --- |
| Arrival, late arrival and no-show | check_in returns arrival_policy_decision_required. No no-show action/state is exposed. Completion is tested from a trusted existing Checked-in fixture; this does not bypass the missing arrival procedure. |
| Late cancellation/owner cancellation after arrival | Automated cancellation is pre-check-in Pending/Confirmed only. Late operations conflict; contact/support UI and procedure remain necessary. No fee, punishment or release timing was invented. |
| Child age bands, infants and party distribution | Configured aggregate adult/child/total capacities are enforced/snapshotted. Infant/unknown occupancy fields are rejected. Age classification and detailed room-party distribution remain undecided. |
| Request-size policy | Engineering ceilings: 10 lines, quantity 100, 60 line/night rows, 366 days, 20 charges, USD 10 million total and USD 1 million per unit night/charge. These are technical safeguards, not agreed commercial stay limits; pilot limits/load validation remain open. |
| Physical rooms | Quantity-per-night availability cannot prove one physical room remains continuously available across unit-specific maintenance. Validate with pilot owners. |
| External details | Owner-only anonymous external entry reserves catalog-priced nights immediately. Contact fields, negotiated prices and consent evidence need a later contract; no external guest account is fabricated. |
| Email/reminders/jobs | Provider interface and bounded jobs functions exist. Provider/domain, auth-mail reliability, templates, reminder timing, Cron/Queue entrypoint bindings, operator/dead-letter policy and provider deduplication windows remain unconfigured. Runtime fails closed outside local capture mode. |
| Admin/support/suspension | No implicit admin booking access. Case-scoped audited support, stronger admin authentication, moderation, additional-property review and suspended-owner procedures remain open. Existing stays are not silently cancelled. |
| Supply/discovery/UI | Owner onboarding, property/room/rate/calendar creation interfaces, discovery/search, media, saved places/reports and shadcn/ui screens are outside this slice. Synthetic fixtures supply the catalog for validation. |
| Operations | Staging, configured services, load/performance, monitoring/alerts, backup/export/restore drills, retention/erasure and recovery objectives remain unverified. |

Outbox durability and retries do not promise exactly-once inbox delivery. A provider may deliver before its response or the database acknowledgement is lost; the stable key helps only within the provider's supported deduplication window. Five-minute fenced leases and backoff from 60 seconds up to one hour are technical defaults requiring staging validation.

## References checked

- [D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth email integration](https://better-auth.com/docs/concepts/email)

These references inform implementation contracts; test outcomes are local repository observations.
