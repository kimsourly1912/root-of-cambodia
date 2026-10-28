# Root of Cambodia — Schema and Booking-Rule Review

Date: 28 October 2026

Scope: Review the product/build contracts and the isolated local D1 reservation proof. This does not finalize the application migrations or certify a production booking engine.

## Result

The small atomic allocation approach remains viable in the local fixture. The original proof needed stronger snapshot, date, numeric, and transition guards. Those safeguards have been added and exercised with 18 D1 tests. The production schema is still a planned model: the tables for the full product have not been implemented.

Four new regression tests first failed against the original proof: quote mutation, terminal-state reopening, fractional inventory, and owner cancellation without a reason. The existing capacity constraint already prevented blocks/reductions from displacing confirmed allocations. The expanded suite passes after the fixes.

## Findings and changes

| Finding | Consequence | Follow-up proof behavior |
| --- | --- | --- |
| Quote header and nightly rows were mutable | Submitted price or room demand could change | Header fields and existing nightly rows cannot be rewritten/deleted; sealed requests reject extra rows or unsealing |
| Row count did not establish complete stay coverage | A quote could omit an occupied date | Canonical local dates, check-in/checkout range, complete coverage for each room type, constant quantity per type, checkout excluded |
| Total was detached from nightly prices | Confirmation could accept an inconsistent total | Store integer nightly unit prices and mandatory fee total; reconcile them during atomic confirmation |
| SQLite INTEGER affinity alone did not prohibit fractional quantities | Partial rooms could enter inventory | Explicit integer checks for stock, quantities, money, and timestamps |
| State changes could reopen cancelled requests | Lifecycle could bypass intended operations | Allowed transition guard and pending-only insert guard; confirmation requires a sealed snapshot |
| Owner cancellation had no reason or attributable context | Guest/support lacked a durable explanation | Explicit operation context, verified actor and ownership checks, owner reason, retained cancellation metadata protected against later edits |
| Capacity editing needed targeted evidence | Potential displacement of committed rooms | Regression confirms capacity reductions/blocks fail while confirmed stock remains intact |

The snapshot seal is a fixture construction boundary. It does not implement the production submission endpoint, public quote validation, or a complete policy snapshot. Malformed fixtures can still be constructed for negative tests; confirmation rejects them without allocating stock.

## Validation

Run from `proofs/foundation/` with the pinned Node/npm versions:

```sh
npm run typecheck
npm run test:d1
npm run build:worker
npm run test:worker
```

| Check on the reviewed revision | Observed result |
| --- | --- |
| TypeScript | Passed |
| D1/Drizzle tests | 18 passed |
| Next.js production build and OpenNext Worker bundle | Passed |
| Built Worker HTTP checks | 9 passed under local workerd |

The first rebuild from this checkout failed because its dependency directory was a symlink into the earlier proof directory. Using a local copy of the same installed dependencies resolved tracing/bundling without changing package versions or build configuration. A fresh checkout should use `npm ci` inside the fixture as documented.

The D1 suite covers:

- Drizzle visibility of the native D1 committed reservation.
- Last-room contention, all-night rollback, missing inventory, and no partial events/outbox.
- Repeated acceptance and cancellation allocating/releasing exactly once.
- Expired requests, unverified actors, and cross-owner acceptance rejection.
- Pending cancellation without a stock adjustment.
- Immutable submitted quote rows/header and a required seal.
- Terminal reopening/direct confirmation insert rejection.
- Fractional inventory and money rejection.
- Required owner reason and immutable cancellation metadata.
- Blocking/capacity reductions against committed inventory.
- Gapped dates, checkout exclusion, canonical dates, and inconsistent totals.
- Guest/owner cancellation context without granting access to someone else's booking.

The Worker harness exercises the actual built Next.js/OpenNext bundle with local workerd, Better Auth sessions, cookie/origin boundaries, an HTTP acceptance race, cross-owner rejection, password reset, and throttling. It uses local captured email and synthetic accounts; no email is sent.

See the historical [foundation check](Root-of-Cambodia-Foundation-Check.md) for the original seven-test result and runtime limitations. This review expands that fixture rather than replacing the historical evidence.

## Production gates still open

| Work | Required before the relevant product flow goes live |
| --- | --- |
| Complete migrations | Auth/owner/place/property/room relations, indexes, explicit delete/retention rules, publication states, and tested upgrade migrations |
| Quote and request service | Server-generated versioned quotes; published-property and verified-session checks; room/occupancy limits; 24-hour lead time; authoritative 12-hour expiry; immutable names, policies, occupancy, itemized mandatory charges and currency |
| Stable room-line model | Explicit line IDs and full date coverage per line; maximum stay/quantity/money bounds and overflow prevention; multi-room-type regression cases |
| Lifecycle | Decline/expiry event and outbox operations, arrival/completion/no-show, full cancellation policy, and history for every transition |
| External reservations | Real owner entry operation using the same inventory invariant; race tests against online acceptance; no direct counter edits from UI |
| Edits and retries | Versioned inventory/rate edits, scoped idempotency keys and request fingerprints, stable replay results, timeout recovery |
| Owner/super-admin workflows | Additional-property review, sensitive edits, suspension with upcoming stays, authorized audited support |
| Delivery and infrastructure | Configured email/domain, outbox publication/recovery, queue deduplication/retries, media, staging deployment, monitoring, backup export/restore drill |
| Product validation | Khmer search and typography, real owner calendars, physical-unit continuity over a stay, responsive and accessible screens |

The fixture's `expected_nights` is a count of quoted room-type/date rows, not a production stay-duration field. Its simplified fee total and booking-level cancellation metadata do not replace itemized charges and a complete append-only event model. A raw SQL connection is trusted infrastructure; triggers do not replace authenticated operation authorization.

Do not run this fresh-database schema as an upgrade for existing data. No remote database or deployment was changed during this review.

## Decisions that still need product input

- No-show/late-arrival cutoff and owner cancellation after check-in.
- Adult/child/infant capacity rules and maximum request/stay size.
- Review of additional properties and important property edits.
- Suspended-owner support for upcoming stays.
- Email provider/domain, reminder timing, pilot budget and recovery targets.

These can be resolved while guest mockups are prepared. Claude should label assumptions in its handoff instead of inventing policies in the interface.

## Mockup handoff

Use [Claude-Mockup-Brief.md](Claude-Mockup-Brief.md) as the primary screen brief, the product plan as the scope authority, and the technical plan as implementation constraints. Start with the five guest screens in Phase 1; owner and super-admin screens follow in separate passes.

The technical plan alone does not describe enough visual hierarchy, interaction states, sample data, or screen acceptance criteria to serve as a reliable mockup prompt.

## Implementation references

- [D1 prepared batches and transaction behavior](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [SQLite trigger semantics](https://www.sqlite.org/lang_createtrigger.html)
- [SQLite date functions](https://www.sqlite.org/lang_datefunc.html)
- [shadcn/ui components](https://ui.shadcn.com/docs/components)

These references inform implementation; local test outcomes above are repository evidence, not claims made by the documentation.
