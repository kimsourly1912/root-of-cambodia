# Root of Cambodia — Database Safeguards Review

Date: 28 October 2026
Scope: implementation-plan step 2, following merged PR #5. This is local verification with synthetic records, not production certification.

## What this step means

The database now checks several rules that the website already followed. This protects against mistakes in future internal code. For example, an internal command labelled “decline” cannot confirm a booking, and cancellation at or after scheduled check-in cannot release its rooms through the currently supported cancellation flow.

This does not settle late cancellation, arrival or no-show policy. The arrival endpoint remains blocked. The approved Next.js, Workers/D1, Drizzle, Better Auth and Vitest choices are retained; payment remains at the property.

## Findings and fixes

| Source-review finding | Implemented safeguard |
| --- | --- |
| Transition attribution checked the actor but not the command kind | Each permitted status change requires its matching command and role, in addition to existing verified-user/property checks |
| The cancellation cutoff existed only in service SQL | A database guard rejects both supported guest and owner cancellations when checkin_at <= the database clock |
| SQLite allowed null identities in business TEXT PRIMARY KEY columns | Insert/update guards reject NULL for all eleven affected scalar business identities |
| Out-of-range instants could turn date comparisons into NULL, which does not fail a SQLite CHECK | Submission, expiry, check-in and checkout must be convertible integer UTC instants |
| Saved arrival/departure clock times could disagree with saved instants | HH:mm snapshots must be valid and exactly match their local date/UTC instant at Cambodia's +07:00 offset |
| A trusted writer could relabel an operation or overwrite its completed receipt | Command identity, attribution, fingerprint and creation time are immutable; a non-null result cannot be replaced |

These are defense against future trusted-writer mistakes, not evidence that anonymous visitors could execute arbitrary SQL. Existing HTTP authentication, authorization and mutation guards remain necessary.

## Migration design and compatibility

[0004_booking_safeguards.sql](../packages/backend/migrations/0004_booking_safeguards.sql) adds bounded guards. Migrations 0001–0003, tables, indexes, existing constraints and deletion rules are unchanged. There is no table rebuild, booking rewrite or destructive cleanup. The existing primary-key column metadata still reports its original nullability; the new triggers enforce non-null business identities. Generated Better Auth tables are unchanged.

Before installing guards, the migration checks existing business identities and booking schedules. An incompatible row fails the named migration_0004_existing_data_valid constraint. Apply the whole file through the atomic D1 migration runner. Do not execute individual statements by hand. A failed upgrade must leave the prior schema/data/migration tracking intact.

If preflight fails, stop and investigate the affected rows in a separately reviewed repair plan. Do not disable retention triggers, delete history or overwrite submitted snapshots merely to force the upgrade through. No automatic repair policy is introduced here. Preflight scans existing bookings; migration time and impact on a large remote database still need staging measurement.

Schedules are validated against their saved values, not the property's current arrival time or policy. Existing booking snapshots therefore remain valid when an owner changes future property settings.

### Command mapping

| From / to | Required kind / role |
| --- | --- |
| Building / Pending, online | submit / guest |
| Building / Confirmed, external | submit / owner |
| Pending / Confirmed | accept / owner |
| Pending / Declined | decline / owner |
| Pending / Expired | expire / system |
| Pending or Confirmed / Cancelled | cancel_guest / guest, or cancel_owner / owner |
| Confirmed / Checked in | check_in / owner; trusted SQL fixture only while arrival policy is unresolved |
| Checked in / Completed | complete / owner |

Online and external requests retain their existing submit command and fingerprint format, preserving retry compatibility. The completion fixture now uses check_in for newly constructed history; this exposes no import/admin endpoint. A populated upgrade test preserves historical checked_in_import attribution unchanged and then completes that existing stay normally. New transitions using that old fixture label are rejected.

## Verification

The first targeted run against migrations 0001–0003 reported 22 failures and one passing positive case. All failures were missing expected rejections, confirming the database gaps before the fix. Two additional command-mapping regressions and three upgrade scenarios were then added.

| Check | Observed result |
| --- | --- |
| Native Workers/D1 Vitest tests | 52 passed: 24 retained scenarios, 25 safeguards scenarios and 3 added upgrade scenarios |
| Combined npm test | 53 tests across five files passed: 52 database tests plus one built-Worker journey |
| Actual rebuilt Next.js/OpenNext Worker | All 12 HTTP checks retained and passing within that journey |
| Fresh install | All four migrations applied through both the native helper and local Wrangler CLI; Better Auth schema/FKs/index checks passed |
| Populated upgrade | Pending, Confirmed, Cancelled and historical Checked-in stays retained, with exact equality of application table contents before/after |
| Upgrade continuity | Existing table/index/trigger definitions preserved; repeated migration discovery/application safe; original acceptance receipt still replayed after cancellation; an upgraded historical Checked-in stay could complete |
| Incompatible legacy data | Null-identity and incoherent-schedule fixtures rejected; entire prior schema/data and unapplied migration tracking preserved |
| TypeScript and formatting | Passed |
| Next.js and OpenNext build | Passed |
| Existing migrations, package versions and lockfile | Unchanged |

Verification used Linux, Node 24.22.1, npm 11.9.0, Vitest 5.0.5 and @cloudflare/vitest-plugin 1.4.9. Earlier Windows/npm observations in the alignment report remain historical. Local initialization, generated binding types and the Next.js incremental type cache needed refreshing before the final successful build; no runtime/framework configuration was changed to suppress errors.

The upgrade comparison covers all application tables (including identity, catalog, full quote/occupancy/policy snapshots, stable lines, live/released allocations, operations/assertions, history, outbox and delivery attempts), excluding internal SQLite bookkeeping and migration tracking that necessarily advances. The fixture changes current property rules before upgrade to prove old submitted schedules remain authoritative.

Wrong-command and late-cancellation regressions compare booking status, reserved totals, allocations, events, outbox and operation counts after rejection to prove batch rollback. Cancellation fixtures use the database's current scheduled minute, at or up to 59 seconds past check-in; they do not claim a frozen-clock test at the exact zero-second boundary. The trigger explicitly rejects equality with <=. Existing positive pre-check-in cancellation and release-once scenarios also pass. Remote timing/performance and real-world load remain unverified.

## Remaining work and decisions

Step 3 is the next implementation task: separate named atomic database operations from business services while preserving behavior. Workspace/jobs organization comes afterward; no broad folder move is included here.

Arrival/no-show/late cancellation, infant/age bands, physical-room continuity, external guest/contact/price rules, audited admin support, suspension handling, email provider/domain, reminders, retention and recovery targets remain unresolved. No policy for those flows was invented.

Remote D1 behavior, real HTTPS/session/email integration, Cron/Queues delivery, provider deduplication, load, monitoring and restore drills remain staging/release work. The existing OpenNext build-chain dependency audit finding remains recorded in the [Vitest alignment report](Root-of-Cambodia-Vitest-Alignment.md); this change does not upgrade dependencies or claim to resolve it. No deployment or live email is authorized or performed.

## Primary references

- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) — versioned migration application and failure rollback.
- [SQLite CREATE TABLE](https://www.sqlite.org/lang_createtable.html) — primary-key NULL behavior and CHECK expressions evaluating to NULL.
- [SQLite date/time functions](https://www.sqlite.org/lang_datefunc.html) — integer Unix timestamps and explicit timezone offsets.
- [Approved booking/database design](Root-of-Cambodia-Booking-Database-Design.md) and [implementation plan](Root-of-Cambodia-Implementation-Plan.md) — project authority and scope.
