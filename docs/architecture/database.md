# Database and atomic operation contract

**Status:** accepted invariants; implemented in ordered SQL.

**Responsible role:** backend maintainer (responsibility, not an assigned person).

**Last source verification:** 30 October 2026; owner-response implementation based on guest PR #25 head [a5bf41f](https://github.com/kimsourly1912/root-of-cambodia/commit/a5bf41ff6d54351358cd307b5ef4b9ded3f9d233).

**Sources:** [packages/backend/migrations/](../../packages/backend/migrations), [packages/backend/src/operations.ts](../../packages/backend/src/operations.ts), [packages/backend/src/booking-persistence.ts](../../packages/backend/src/booking-persistence.ts), [packages/backend/src/schema.ts](../../packages/backend/src/schema.ts), [tests/migrations.test.ts](../../tests/migrations.test.ts), [tests/safeguards.test.ts](../../tests/safeguards.test.ts).

## Schema authority and migration ownership

[SQL migrations](../../packages/backend/migrations/) own the complete schema, including constraints, composite foreign keys, delete restrictions and triggers. [schema.ts](../../packages/backend/src/schema.ts) is a partial Drizzle read projection. It is not a second schema/deployment authority. Review Better Auth schema changes into the same migration process; do not use runtime auto-migration or schema push against live requests.

| Migration | Responsibility |
| --- | --- |
| [0001](../../packages/backend/migrations/0001_identity_catalog.sql) | Auth identity, owner/place/property/room catalog, nightly rates and stock |
| [0002](../../packages/backend/migrations/0002_booking_operations.sql) | Operations/receipts, booking snapshots, legal transitions, allocations, history, outbox and stock events |
| [0003](../../packages/backend/migrations/0003_delivery_recovery.sql) | Delivery diagnostics/recovery indexes and immutability |
| [0004](../../packages/backend/migrations/0004_booking_safeguards.sql) | Populated-data preflight, non-null identities, coherent instants, matching commands, cancellation/receipt guards |
| [0005](../../packages/backend/migrations/0005_property_drafts.sql) | Private draft attributable events |
| [0006](../../packages/backend/migrations/0006_room_type_history.sql) | Room history |
| [0007](../../packages/backend/migrations/0007_room_calendar_history.sql) | Immutable per-night calendar history |
| [0008](../../packages/backend/migrations/0008_property_information.sql) | Versioned information extension and attributable events |
| [0009](../../packages/backend/migrations/0009_property_media.sql) | Media journal, gallery versions, removal tombstones and events |
| [0010](../../packages/backend/migrations/0010_property_logistics.sql) | Independently versioned private coordinates/contact/arrival instructions and attributable events |
| [0011](../../packages/backend/migrations/0011_property_publication_review.sql) | Single reviewer configuration, immutable review requests/events and separately sealed owner/reviewer command receipts |
| [0012](../../packages/backend/migrations/0012_public_listing_disclosure.sql) | Immutable owner-attributed public-display version/digest, new submission seal/approval guards and latest-review index; no backfill of earlier approvals |
| [0013](../../packages/backend/migrations/0013_guest_booking_journey.sql) | Immutable configured terms documents and account-bound request reviews; UI-path submission fencing; no old-data backfill |
| [0014](../../packages/backend/migrations/0014_booking_acceptance_logistics.sql) | Atomic acceptance-time logistics copies, direct transition/receipt guards and immutable owner response reviews; no historical backfill |

Add a new ordered migration; do not rewrite an applied one. Verify both fresh application and populated upgrades using the configured migration loader/tracker. A failed preflight needs a reviewed repair plan, never deletion of a populated database to force success. The proof schema is independent and is not an application upgrade path.

## Data relationships

Auth users have sessions and optional owner profiles. A place has a property with one owner; properties have room types; each room/date has at most one stock and one rate row. A booking belongs to a property and, for online requests, a guest. Stable booking lines identify room type/quantity/party/capacity; night and charge rows make up the immutable quote. Allocations reference booked room nights and retain one-time release evidence. Attributable booking events create recipient outbox records; delivery attempts belong to those records.

Private property information, location/contact/arrival details and media/gallery records extend owned properties. Property/room/calendar/information/logistics/media events keep attributable versions; they do not all store historical field contents. Do not promise recovery of old descriptions from a revision-only event.

## Invariants and atomic saves

- Integer USD cents and bounded integer quantities; canonical local ISO dates, explicit UTC instants, `Asia/Phnom_Penh` schedule interpretation. Checkout does not consume another night.
- Stock always satisfies `reserved + blocked <= capacity`. Reservation counters are controlled by booking allocation/release, not editable calendar inputs.
- Submission builds header, stable lines, every expected room/night, charges, immutable names/contact/policy/terms, total and receipt in one operation. Internal `building` is sealed to Pending/Confirmed before exposure and excluded from booking detail reads.
- Coverage requires each expected occupied date, quantity and price, not just the same row count. Reconcile nightly totals and per-stay mandatory charges.
- Write-time checks revalidate current verification, ownership/publication, revisions, deadlines and stock. Early service checks improve errors but cannot replace commit-time guards.
- Online Pending reserves nothing. Acceptance checks strict pre-expiry and allocates every night. Missing/insufficient stock or any later-night failure rolls back everything.
- Cancellation releases only committed unreleased allocations once. Decline/expiry never add stock. Legal transitions, command/actor mapping and supported cancellation cutoff are enforced in SQL too.
- Operation, actual writes, required history/outbox, receipt and final assertion share one D1 batch. Zero-row writes cannot leave success receipts or unconditional side effects. Failed required history/outbox work aborts the save.
- Submitted snapshots and history are immutable/retained by database guards. Current catalog/rate edits cannot rewrite submitted prices or accepted policies.

The named boundaries include [booking-persistence.ts](../../packages/backend/src/booking-persistence.ts), [inventory-persistence.ts](../../packages/backend/src/inventory-persistence.ts), draft/room/calendar/information/logistics/media persistence and [publication-persistence.ts](../../packages/backend/src/publication-persistence.ts). Do not expose arbitrary CRUD that independently mutates reservation state.

Constraints protect relationships/numbers; bounded triggers validate transitions and perform defined allocation/release/history/outbox effects. They never call external providers or decide unresolved policies. BEFORE triggers validate/reject, while critical effects use reviewed AFTER triggers; correctness must not depend on unspecified ordering between triggers. Read SQL and its regressions together; [0002 ADR](decisions/0002-atomic-booking-operations.md) preserves the tradeoff.

## Replay and uncertain outcomes

[operations.ts](../../packages/backend/src/operations.ts) scopes a key to a principal (`user:<id>` or system), with role and normalized operation payload in the fingerprint. The same key with another kind/payload conflicts; it is not a separate key namespace per endpoint. Keys accept 1–128 ASCII letters/digits/colon/underscore/hyphen.

Publication submit/approval additionally repeat the shared minimum-content/calendar predicates inside the guarded state write using database time. This needs no schema change; existing receipts are replayed before new eligibility checks and existing published listings are not automatically unpublished.

Publication review uses a separate actor/key namespace because the preserved booking operation role vocabulary excludes reviewer. See the [review contract](../features/publication-review.md#state-snapshot-and-atomicity).

Successful receipts are stored atomically. Services recheck access before replay. A matching receipt describes that operation's original result, even after a later cancellation or catalog change. Refresh the current authorized record afterward. Quote preparation is deferred until no matching receipt exists.

After a timeout/503/unknown outcome, recover and retry the **same key and payload**. A failed receipt lookup leaves uncertainty; do not assume failure or invent a fresh operation. Definite refusals have no successful receipt; a later deliberate new attempt may use a new key after resolving the refusal. Receipt retention/retry windows remain D09.

## Indexes, recovery and verification

Existing indexes cover property ownership/catalog discovery, room/property, room/night uniqueness, guest/property bookings, expiry, allocations/events, outbox due/lease recovery and removed-media cleanup. Their existence is not a measured throughput guarantee; inspect plans and bounded production workloads before changing them.

R2 writes are outside D1 atomicity: [media ADR](decisions/0004-private-media-lifecycle.md) explains journaling, immutable objects and tombstones. Retention/erasure, pending expiry, exports, restore and alert ownership remain [D09/D10](../product/open-decisions.md). Worker rollback cannot undo committed SQL or restore deleted objects.

Use [testing](../development/testing.md) for rollback, races, authorization revocation, replay, exact deadlines and populated upgrades; see [bookings](../features/bookings.md), [owner supply](../features/owner-supply.md) and [release/recovery](../operations/release-and-recovery.md). Historical safeguards findings are preserved in the [archive](../archive/README.md), not treated as all still pending.

## Public listing acknowledgement

[Guest browsing](../features/guest-browsing.md) uses an allowlist of immutable approved content. Public-display evidence is part of the same submission batch and records the current owner, request, policy version, displayed digest and database timestamp. New submit seals and approvals require it. Earlier sealed receipts still replay; earlier approved data is not backfilled or exposed. Ordered gallery construction is explicit for new snapshots; earlier stored snapshots remain immutable. Migration 0012 is additive, but older code cannot create new submissions without its required evidence; future rollout/rollback must preserve this privacy guard. No booking schema/operation rule changes.

Accepted D17 is implemented by [booking logistics](../../packages/backend/src/booking-logistics.ts), [owner responses](../../packages/backend/src/owner-bookings.ts) and the named booking transition save. The acceptance copy and transition/allocation/history/outbox/receipt are one atomic operation; terms/guest quote snapshots stay immutable at submission. New migration 0014 preserves prior receipts and old Confirmed records without fabricating copies. New native fixtures explicitly prepare required logistics; historical migration fixtures construct the old protocol only in tests, with no application compatibility bypass.
